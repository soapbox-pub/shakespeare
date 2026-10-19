import { z } from "zod";

import type { Tool, ToolResult } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";
import { Registry, updateLockfile, type Lockfile, type LockfileUpdate } from "../lockfile";

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

  readonly description = "Safely add an npm package to the project in the current directory, updating package.json and the lockfile (package-lock.json or bun.lock).";

  readonly inputSchema = z.object({
    name: z.string().describe('Name of the npm package to add, eg "lodash"'),
    version: z.string().optional().describe("Version or range (optional, defaults to the latest version)"),
    dev: z.boolean().optional().describe("If true, add to devDependencies (default: false)"),
  });

  constructor(fs: JSRuntimeFS, cwd: string) {
    this.fs = fs;
    this.cwd = cwd;
  }

  async execute(args: NpmAddPackageParams): Promise<ToolResult> {
    const { name, version, dev = false } = args;

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

      // Check if package already exists
      const dependencyKey = dev ? 'devDependencies' : 'dependencies';
      const otherKey = dev ? 'dependencies' : 'devDependencies';

      // If no version is specified and package is already installed, it's a no-op
      if (!version && packageJson[dependencyKey]?.[name]) {
        const currentVersion = packageJson[dependencyKey][name];
        return { content: `ℹ️ Package ${name} is already installed in ${dependencyKey} with version ${currentVersion}.` };
      }

      // Find the version to install
      const registry = new Registry(await this.readProjectFile('.npmrc') ?? '');
      let targetVersion: string;
      try {
        const manifest = await registry.pick(name, version ?? 'latest');
        if (!manifest) throw new Error(version ? `no version matches ${version}` : 'package not found');
        targetVersion = manifest.version;
      } catch (error) {
        const what = version ? `${name}@${version}` : `latest version for ${name}`;
        throw new Error(`❌ Could not fetch ${what}. Package or version may not exist, or the registry is unavailable.\n\nError: ${String(error)}`);
      }

      // Check if package already exists with the specific version
      if (packageJson[dependencyKey]?.[name] === `^${targetVersion}`) {
        return { content: `ℹ️ Package ${name}@${targetVersion} is already installed in ${dependencyKey}.` };
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
      sortDependencies(packageJson);

      // Resolve the lockfile before writing anything, so a failure leaves the project as it was
      let lockfile: LockfileUpdate | undefined;
      try {
        lockfile = await updateLockfile((file) => this.readProjectFile(file), packageJson, registry);
      } catch (error) {
        throw new Error(`❌ Could not install ${name}@${targetVersion}'s dependencies: ${error instanceof Error ? error.message : String(error)}`);
      }

      await this.fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', "utf8");
      if (lockfile && 'text' in lockfile) {
        await this.fs.writeFile(`${this.cwd}/${lockfile.file}`, lockfile.text, "utf8");
      }

      return {
        content: `✅ Successfully added ${name}@${targetVersion} to ${dependencyKey}\n\n📦 Package: ${name}\n🏷️ Version: ^${targetVersion}\n📁 Type: ${dev ? 'Development dependency' : 'Production dependency'}\n📄 Updated: ${updatedFiles(lockfile)}${lockfileNotes(lockfile)}`
      };
    } catch (error) {
      throw new Error(`❌ Error adding package ${name}: ${String(error)}`);
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

export function sortDependencies(packageJson: PackageJson): void {
  for (const key of ['dependencies', 'devDependencies'] as const) {
    const deps = packageJson[key];
    if (deps) {
      packageJson[key] = Object.fromEntries(Object.keys(deps).sort().map((name) => [name, deps[name]]));
    }
  }
}

export function updatedFiles(lockfile: LockfileUpdate | undefined): string {
  return lockfile && 'text' in lockfile ? `package.json, ${lockfile.file}` : 'package.json';
}

const INSTALL_COMMANDS: Record<Lockfile, string> = {
  'package-lock.json': 'npm install',
  'pnpm-lock.yaml': 'pnpm install',
  'bun.lock': 'bun install',
  'yarn.lock': 'yarn install',
};

/** What the agent should know about the lockfile: conflicts, or that it couldn't be updated. */
export function lockfileNotes(lockfile: LockfileUpdate | undefined): string {
  if (!lockfile) return '';
  if ('unsupported' in lockfile) {
    return `\n\n⚠️ ${lockfile.file} was not updated: only package-lock.json and bun.lock can be updated here. Builds still work, using the ranges in package.json, but \`${INSTALL_COMMANDS[lockfile.file]}\` needs to be run elsewhere to bring ${lockfile.file} up to date.`;
  }
  if (lockfile.warnings.length) {
    const consequence = lockfile.file === 'package-lock.json' ? ' (`npm ci` will fail until they are resolved)' : '';
    return `\n\n⚠️ Peer dependency conflicts${consequence}:\n${lockfile.warnings.map((w) => `- ${w}`).join('\n')}`;
  }
  return '';
}
