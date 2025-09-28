import { z } from "zod";

import type { Tool } from "./Tool";
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

interface PackageLockJson {
  name: string;
  version: string;
  lockfileVersion: number;
  requires: boolean;
  packages: Record<string, PackageLockEntry>;
  [key: string]: unknown;
}

interface PackageLockEntry {
  version?: string;
  resolved?: string;
  integrity?: string;
  license?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  dev?: boolean;
  engines?: Record<string, string>;
  funding?: unknown;
  [key: string]: unknown;
}

interface NpmRegistryResponse {
  version: string;
  dist: {
    tarball: string;
    integrity: string;
  };
  license?: string;
  engines?: Record<string, string>;
  funding?: unknown;
  [key: string]: unknown;
}

export class NpmAddPackageTool implements Tool<NpmAddPackageParams> {
  private fs: JSRuntimeFS;
  private cwd: string;

  readonly description = "Safely add an npm package to the project in the current directory.";

  readonly inputSchema = z.object({
    name: z.string().describe('Name of the npm package to add, eg "lodash"'),
    version: z.string().optional().describe("Version (optional)"),
    dev: z.boolean().optional().describe("If true, add to devDependencies (default: false)"),
  });

  constructor(fs: JSRuntimeFS, cwd: string) {
    this.fs = fs;
    this.cwd = cwd;
  }

  async execute(args: NpmAddPackageParams): Promise<string> {
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
        return `ℹ️ Package ${name} is already installed in ${dependencyKey} with version ${currentVersion}.`;
      }

      // Determine version to use and fetch package metadata
      let targetVersion = version;
      let packageMetadata: NpmRegistryResponse;

      if (!targetVersion) {
        try {
          packageMetadata = await this.fetchPackageMetadata(name);
          targetVersion = packageMetadata.version;
        } catch (error) {
          throw new Error(`❌ Could not fetch latest version for ${name}. Package may not exist or npm registry is unavailable.\n\nError: ${String(error)}`);
        }
      } else {
        try {
          packageMetadata = await this.fetchPackageMetadata(name, targetVersion);
        } catch (error) {
          throw new Error(`❌ Could not fetch metadata for ${name}@${targetVersion}. Version may not exist or npm registry is unavailable.\n\nError: ${String(error)}`);
        }
      }

      // Check if package already exists with the specific version
      if (packageJson[dependencyKey]?.[name]) {
        const currentVersion = packageJson[dependencyKey][name];
        if (currentVersion === `^${targetVersion}`) {
          return `ℹ️ Package ${name}@${targetVersion} is already installed in ${dependencyKey}.`;
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

      // Update package-lock.json if it exists
      await this.updatePackageLock(name, targetVersion, packageMetadata, dev);

      return `✅ Successfully added ${name}@${targetVersion} to ${dependencyKey}\n\n📦 Package: ${name}\n🏷️ Version: ^${targetVersion}\n📁 Type: ${dev ? 'Development dependency' : 'Production dependency'}\n📄 Updated: package.json${await this.packageLockExists() ? ', package-lock.json' : ''}`;
    } catch (error) {
      throw new Error(`❌ Error adding package ${name}: ${String(error)}`);
    }
  }

  private async fetchPackageMetadata(packageName: string, version?: string): Promise<NpmRegistryResponse> {
    const url = version
      ? `https://registry.npmjs.org/${packageName}/${version}`
      : `https://registry.npmjs.org/${packageName}/latest`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.version) {
      throw new Error('No version found in npm registry response');
    }

    if (!data.dist || !data.dist.tarball || !data.dist.integrity) {
      throw new Error('Missing distribution metadata in npm registry response');
    }

    return data;
  }

  private async packageLockExists(): Promise<boolean> {
    try {
      await this.fs.readFile(`${this.cwd}/package-lock.json`, "utf8");
      return true;
    } catch {
      return false;
    }
  }

  private async updatePackageLock(
    packageName: string,
    version: string,
    metadata: NpmRegistryResponse,
    isDev: boolean
  ): Promise<void> {
    const packageLockPath = `${this.cwd}/package-lock.json`;

    try {
      const packageLockContent = await this.fs.readFile(packageLockPath, "utf8");
      const packageLock: PackageLockJson = JSON.parse(packageLockContent);

      // Update root package dependencies
      const rootPackage = packageLock.packages[""];
      if (rootPackage) {
        if (isDev) {
          if (!rootPackage.devDependencies) {
            rootPackage.devDependencies = {};
          }
          rootPackage.devDependencies[packageName] = `^${version}`;

          // Remove from dependencies if it exists there
          if (rootPackage.dependencies?.[packageName]) {
            delete rootPackage.dependencies[packageName];
            if (Object.keys(rootPackage.dependencies).length === 0) {
              delete rootPackage.dependencies;
            }
          }
        } else {
          if (!rootPackage.dependencies) {
            rootPackage.dependencies = {};
          }
          rootPackage.dependencies[packageName] = `^${version}`;

          // Remove from devDependencies if it exists there
          if (rootPackage.devDependencies?.[packageName]) {
            delete rootPackage.devDependencies[packageName];
            if (Object.keys(rootPackage.devDependencies).length === 0) {
              delete rootPackage.devDependencies;
            }
          }
        }

        // Sort dependencies alphabetically
        if (rootPackage.dependencies) {
          const sorted = Object.keys(rootPackage.dependencies).sort().reduce((acc, key) => {
            acc[key] = rootPackage.dependencies![key];
            return acc;
          }, {} as Record<string, string>);
          rootPackage.dependencies = sorted;
        }

        if (rootPackage.devDependencies) {
          const sorted = Object.keys(rootPackage.devDependencies).sort().reduce((acc, key) => {
            acc[key] = rootPackage.devDependencies![key];
            return acc;
          }, {} as Record<string, string>);
          rootPackage.devDependencies = sorted;
        }
      }

      // Add/update node_modules entry
      const nodeModulesKey = `node_modules/${packageName}`;
      const nodeModulesEntry: PackageLockEntry = {
        version: version,
        resolved: metadata.dist.tarball,
        integrity: metadata.dist.integrity
      };

      if (metadata.license) {
        nodeModulesEntry.license = metadata.license;
      }

      if (isDev) {
        nodeModulesEntry.dev = true;
      }

      if (metadata.engines) {
        nodeModulesEntry.engines = metadata.engines;
      }

      if (metadata.funding) {
        nodeModulesEntry.funding = metadata.funding;
      }

      packageLock.packages[nodeModulesKey] = nodeModulesEntry;

      // Sort packages by key (node_modules entries should come after root)
      const sortedPackages: Record<string, PackageLockEntry> = {};

      // Add root package first
      if (packageLock.packages[""]) {
        sortedPackages[""] = packageLock.packages[""];
      }

      // Add sorted node_modules entries
      const nodeModulesKeys = Object.keys(packageLock.packages)
        .filter(key => key.startsWith("node_modules/"))
        .sort();

      for (const key of nodeModulesKeys) {
        sortedPackages[key] = packageLock.packages[key];
      }

      packageLock.packages = sortedPackages;

      // Write updated package-lock.json
      const updatedLockContent = JSON.stringify(packageLock, null, 2) + '\n';
      await this.fs.writeFile(packageLockPath, updatedLockContent, "utf8");
    } catch (error) {
      // If package-lock.json doesn't exist or is invalid, we don't fail the operation
      // This is consistent with npm behavior where package-lock.json is optional
      console.warn(`Could not update package-lock.json: ${String(error)}`);
    }
  }
}