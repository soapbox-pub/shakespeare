import { z } from "zod";

import type { Tool, ToolResult } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";
import { Registry, updateLockfile, type LockfileUpdate } from "../lockfile";
import { lockfileNotes, sortDependencies, updatedFiles } from "./NpmAddPackageTool";

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

  readonly description = "Safely remove an npm package from the project in the current directory, updating package.json and the lockfile (package-lock.json or bun.lock).";

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

      sortDependencies(packageJson);

      // Usually this only drops packages, but a stale lockfile may need some fetched.
      let lockfile: LockfileUpdate | undefined;
      try {
        const registry = new Registry(await this.readProjectFile('.npmrc') ?? '');
        lockfile = await updateLockfile((file) => this.readProjectFile(file), packageJson, registry);
      } catch (error) {
        throw new Error(`❌ Could not update the lockfile: ${error instanceof Error ? error.message : String(error)}`);
      }

      await this.fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', "utf8");
      if (lockfile && 'text' in lockfile) {
        await this.fs.writeFile(`${this.cwd}/${lockfile.file}`, lockfile.text, "utf8");
      }

      return {
        content: `✅ Successfully removed ${name} from ${foundIn}\n\n📦 Package: ${name}\n🏷️ Version: ${removedVersion}\n📁 Removed from: ${foundIn}\n📄 Updated: ${updatedFiles(lockfile)}${lockfileNotes(lockfile)}`
      };
    } catch (error) {
      throw new Error(`❌ Error removing package ${name}: ${String(error)}`);
    }
  }

  private async readProjectFile(file: string): Promise<string | undefined> {
    try {
      return await this.fs.readFile(`${this.cwd}/${file}`, "utf8");
    } catch {
      return undefined;
    }
  }
}