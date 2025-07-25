import { z } from "zod";

import type { Tool, CallToolResult } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";

interface NpmAddPackageParams {
  name: string;
  version?: string;
  dev?: boolean;
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export class NpmAddPackageTool implements Tool<NpmAddPackageParams> {
  private fs: JSRuntimeFS;
  private cwd: string;

  readonly description = "Safely add an npm package to the project in the current directory.";

  readonly parameters = z.object({
    name: z.string().describe('Name of the npm package to add, eg "lodash"'),
    version: z.string().optional().describe("Version (optional)"),
    dev: z.boolean().optional().describe("If true, add to devDependencies (default: false)"),
  });

  constructor(fs: JSRuntimeFS, cwd: string) {
    this.fs = fs;
    this.cwd = cwd;
  }

  async execute(args: NpmAddPackageParams): Promise<CallToolResult> {
    const { name, version, dev = false } = args;

    try {
      // Read current package.json
      const packageJsonPath = `${this.cwd}/package.json`;
      let packageJsonContent: string;

      try {
        packageJsonContent = await this.fs.readFile(packageJsonPath, "utf8");
      } catch {
        return {
          content: [{
            type: "text",
            text: `❌ Could not read package.json at ${packageJsonPath}. Make sure you're in a valid npm project.`,
          }],
          isError: true,
        };
      }

      // Parse package.json
      let packageJson: PackageJson;
      try {
        packageJson = JSON.parse(packageJsonContent);
      } catch {
        return {
          content: [{
            type: "text",
            text: `❌ Invalid package.json format. Could not parse JSON.`,
          }],
          isError: true,
        };
      }

      // Determine version to use
      let targetVersion = version;
      if (!targetVersion) {
        try {
          targetVersion = await this.fetchLatestVersion(name);
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `❌ Could not fetch latest version for ${name}. Package may not exist or npm registry is unavailable.\n\nError: ${String(error)}`,
            }],
            isError: true,
          };
        }
      }

      // Check if package already exists
      const dependencyKey = dev ? 'devDependencies' : 'dependencies';
      const otherKey = dev ? 'dependencies' : 'devDependencies';

      if (packageJson[dependencyKey]?.[name]) {
        const currentVersion = packageJson[dependencyKey][name];
        if (currentVersion === `^${targetVersion}`) {
          return {
            content: [{
              type: "text",
              text: `ℹ️ Package ${name}@${targetVersion} is already installed in ${dependencyKey}.`,
            }],
            isError: false,
          };
        }
      }

      // Remove from other dependency type if it exists there
      if (packageJson[otherKey]?.[name]) {
        delete packageJson[otherKey][name];
        // Clean up empty objects
        if (Object.keys(packageJson[otherKey]).length === 0) {
          delete packageJson[otherKey];
        }
      }

      // Add to appropriate dependencies
      if (!packageJson[dependencyKey]) {
        packageJson[dependencyKey] = {};
      }
      packageJson[dependencyKey][name] = `^${targetVersion}`;

      // Sort dependencies alphabetically
      if (packageJson.dependencies) {
        const sorted = Object.keys(packageJson.dependencies).sort().reduce((acc, key) => {
          acc[key] = packageJson.dependencies![key];
          return acc;
        }, {} as Record<string, string>);
        packageJson.dependencies = sorted;
      }

      if (packageJson.devDependencies) {
        const sorted = Object.keys(packageJson.devDependencies).sort().reduce((acc, key) => {
          acc[key] = packageJson.devDependencies![key];
          return acc;
        }, {} as Record<string, string>);
        packageJson.devDependencies = sorted;
      }

      // Write updated package.json
      const updatedContent = JSON.stringify(packageJson, null, 2) + '\n';
      await this.fs.writeFile(packageJsonPath, updatedContent, "utf8");

      return {
        content: [{
          type: "text",
          text: `✅ Successfully added ${name}@${targetVersion} to ${dependencyKey} in package.json\n\n📦 Package: ${name}\n🏷️ Version: ^${targetVersion}\n📁 Type: ${dev ? 'Development dependency' : 'Production dependency'}\n\n⚠️ **Next step**: Run \`npm install\` to install the package and update package-lock.json`,
        }],
        isError: false,
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Error adding package ${name}: ${String(error)}`,
        }],
        isError: true,
      };
    }
  }

  private async fetchLatestVersion(packageName: string): Promise<string> {
    const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.version) {
      throw new Error('No version found in npm registry response');
    }

    return data.version;
  }
}