import { nameFromPath, splitNameVersion, type LockPackage, type PackageLock } from './tree';

interface V1Dependency {
  version?: string;
  resolved?: string;
  integrity?: string;
  requires?: Record<string, string>;
  dependencies?: Record<string, V1Dependency>;
}

/** Parse package-lock.json (or npm-shrinkwrap.json), any lockfileVersion. */
export function parseNpmLock(text: string): PackageLock {
  const lock: { packages?: Record<string, LockPackage>; dependencies?: Record<string, V1Dependency> } = JSON.parse(text);

  if (lock.packages) {
    const packages: Record<string, LockPackage> = {};
    for (const [path, entry] of Object.entries(lock.packages)) {
      // npm only records `name` for aliases; the index of installs by name@version needs it everywhere.
      packages[path] = path.includes('node_modules/') && !entry.name ? { ...entry, name: nameFromPath(path) } : entry;
    }
    return { packages };
  }

  // lockfileVersion 1 (npm 6) nests the tree instead of listing paths.
  const packages: Record<string, LockPackage> = {};
  const walk = (prefix: string, dependencies: Record<string, V1Dependency>) => {
    for (const [alias, dep] of Object.entries(dependencies)) {
      const path = `${prefix}node_modules/${alias}`;
      let name = alias;
      let version = dep.version;
      const aliased = version?.startsWith('npm:') ? splitNameVersion(version.slice(4)) : undefined;
      if (aliased) [name, version] = aliased;
      packages[path] = {
        name,
        version,
        resolved: dep.resolved,
        integrity: dep.integrity,
        dependencies: dep.requires,
      };
      if (dep.dependencies) walk(`${path}/`, dep.dependencies);
    }
  };
  walk('', lock.dependencies ?? {});
  return { packages };
}
