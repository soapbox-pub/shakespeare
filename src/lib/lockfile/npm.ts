import { depFlags, installMissing, prune, setRootDependencies, stringMap, type Tree, type TreeEntry } from './install';
import { integrityOf, normalizeBin, type Manifest, type Registry } from './registry';
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

const FLAGS = ['dev', 'optional', 'devOptional', 'peer'] as const;

/**
 * Bring package-lock.json in line with package.json, as `npm install` would:
 * install what's missing from the registry, drop what's no longer needed,
 * and recompute the dev/optional/peer flags. Needs lockfileVersion 2 or 3.
 */
export async function updateNpmLock(text: string, manifest: Record<string, unknown>, registry: Registry): Promise<{ text: string; warnings: string[] }> {
  const lock = JSON.parse(text);
  if (!lock.packages) throw new Error('package-lock.json v1 is too old to update; run `npm install` with npm 7 or newer');

  const tree: Tree = lock.packages;
  tree[''] ??= {};
  setRootDependencies(tree[''], manifest);
  sortDependencies(tree['']);
  if (typeof manifest.name === 'string') lock.name = tree[''].name = manifest.name;
  if (typeof manifest.version === 'string') lock.version = tree[''].version = manifest.version;

  const warnings = await installMissing(tree, registry, toNpmEntry, stringMap(manifest.overrides));
  prune(tree);

  for (const [path, flags] of depFlags(tree)) {
    if (path.includes('node_modules/')) setFlags(tree, path, flags);
  }

  lock.packages = Object.fromEntries(Object.keys(tree)
    .sort((a, b) => a === '' ? -1 : b === '' ? 1 : a.localeCompare(b, 'en'))
    .map((key) => [key, tree[key]]));

  // Version 2 repeats the tree in the npm 6 format, which this doesn't maintain.
  if (lock.lockfileVersion === 2 && lock.dependencies) {
    delete lock.dependencies;
    lock.lockfileVersion = 3;
  }
  return { text: JSON.stringify(lock, null, 2) + '\n', warnings };
}

/** A new package-lock.json entry for an installed manifest, with fields in npm's usual order. */
function toNpmEntry(alias: string, manifest: Manifest): TreeEntry {
  const entry: TreeEntry = {};
  if (alias !== manifest.name) entry.name = manifest.name;
  entry.version = manifest.version;
  entry.resolved = manifest.dist.tarball;
  const integrity = integrityOf(manifest);
  if (integrity) entry.integrity = integrity;
  if (manifest.hasInstallScript) entry.hasInstallScript = true;
  const fields: Array<[string, unknown]> = [
    ['dependencies', manifest.dependencies],
    ['optionalDependencies', manifest.optionalDependencies],
    ['bin', normalizeBin(manifest)],
    ['engines', manifest.engines],
    ['os', manifest.os],
    ['cpu', manifest.cpu],
    ['libc', manifest.libc],
    ['peerDependencies', manifest.peerDependencies],
    ['peerDependenciesMeta', manifest.peerDependenciesMeta],
    ['bundleDependencies', manifest.bundleDependencies],
    ['deprecated', manifest.deprecated],
  ];
  for (const [key, value] of fields) {
    if (value === undefined || value === false) continue;
    if (typeof value === 'object' && !Object.keys(value as object).length) continue;
    entry[key] = value;
  }
  sortDependencies(entry);
  return entry;
}

/** npm keeps dependency lists sorted. */
function sortDependencies(entry: TreeEntry): void {
  for (const key of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'peerDependenciesMeta']) {
    const map = entry[key];
    if (map && typeof map === 'object') {
      entry[key] = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b, 'en')));
    }
  }
}

/** Set an entry's flags, leaving it untouched if they're already right. New flags go after `integrity`, as npm puts them. */
function setFlags(tree: Tree, path: string, flags: Record<typeof FLAGS[number], boolean>): void {
  const entry = tree[path];
  if (FLAGS.every((flag) => !!entry[flag] === flags[flag])) return;

  const rebuilt: TreeEntry = {};
  const insert = () => {
    for (const flag of FLAGS) if (flags[flag]) rebuilt[flag] = true;
  };
  let inserted = false;
  for (const [key, value] of Object.entries(entry)) {
    if ((FLAGS as readonly string[]).includes(key)) continue;
    if (!inserted && !['name', 'version', 'resolved', 'integrity', 'link'].includes(key)) {
      insert();
      inserted = true;
    }
    rebuilt[key] = value;
  }
  if (!inserted) insert();
  tree[path] = rebuilt;
}
