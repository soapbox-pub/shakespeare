import { z } from "zod";

import type { Tool, ToolResult } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";

interface NpmRemovePackageParams {
  name: string;
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export class NpmRemovePackageTool implements Tool<NpmRemovePackageParams> {
  private fs: JSRuntimeFS;
  private cwd: string;

  readonly description = "Safely remove an npm package from the project in the current directory.";

  readonly inputSchema = z.object({
    name: z.string().describe("Name of the npm package to remove"),
  });

  constructor(fs: JSRuntimeFS, cwd: string) {
    this.fs = fs;
    this.cwd = cwd;
  }

  async execute(args: NpmRemovePackageParams): Promise<ToolResult> {
    const { name } = args;

    try {
      // Read current package.json
      const packageJsonPath = `${this.cwd}/package.json`;
      let packageJsonContent: string;

      try {
        packageJsonContent = await this.fs.readFile(packageJsonPath, "utf8");
      } catch {
        throw new Error(`❌ Could not read package.json at ${packageJsonPath}. Make sure you're in a valid npm project.`);
      }

      // Parse package.json
      let packageJson: PackageJson;
      try {
        packageJson = JSON.parse(packageJsonContent);
      } catch {
        throw new Error(`❌ Invalid package.json format. Could not parse JSON.`);
      }

      // Check if package exists in dependencies or devDependencies
      let foundIn: 'dependencies' | 'devDependencies' | null = null;
      let removedVersion: string | undefined;

      if (packageJson.dependencies?.[name]) {
        foundIn = 'dependencies';
        removedVersion = packageJson.dependencies[name];
        delete packageJson.dependencies[name];

        // Clean up empty dependencies object
        if (Object.keys(packageJson.dependencies).length === 0) {
          delete packageJson.dependencies;
        }
      } else if (packageJson.devDependencies?.[name]) {
        foundIn = 'devDependencies';
        removedVersion = packageJson.devDependencies[name];
        delete packageJson.devDependencies[name];

        // Clean up empty devDependencies object
        if (Object.keys(packageJson.devDependencies).length === 0) {
          delete packageJson.devDependencies;
        }
      }

      if (!foundIn) {
        return { content: `ℹ️ Package ${name} was not found in package.json dependencies or devDependencies.` };
      }

      // Sort remaining dependencies alphabetically
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
        content: `✅ Successfully removed ${name} from ${foundIn} in package.json\n\n📦 Package: ${name}\n🏷️ Version: ${removedVersion}\n📁 Removed from: ${foundIn}\n\n⚠️ **Next step**: Run \`npm install\` to update node_modules and package-lock.json`
      };
    } catch (error) {
      throw new Error(`❌ Error removing package ${name}: ${String(error)}`);
    }
  }
}