import semver from 'semver';

/** An entry in package-lock.json's `packages` map, the shape every lockfile is converted to. */
export interface LockPackage {
  name?: string;
  version?: string;
  resolved?: string;
  integrity?: string;
  link?: boolean;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/** Installed packages keyed by `node_modules/...` path, as in package-lock.json v2+. */
export interface PackageLock {
  packages: Record<string, LockPackage>;
}

/** A resolved package, for lockfiles that record a dependency graph rather than a layout. */
export interface LockNode {
  name: string;
  version: string;
  resolved?: string;
  integrity?: string;
  /** Node ids, keyed by the name each dependency is installed under (which differs for aliases). */
  dependencies: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export interface LockGraph {
  /** The project's own dependencies: install name -> node id. */
  root: Record<string, string>;
  nodes: Map<string, LockNode>;
}

const NPM_REGISTRY = 'https://registry.npmjs.org/';

/**
 * The tarball URL of a registry package. Returns undefined for JSR packages,
 * whose tarball URLs don't follow the npm pattern; consumers look those up in
 * the registry by version instead.
 */
export function tarballUrl(name: string, version: string, registry = NPM_REGISTRY): string | undefined {
  if (!semver.valid(version)) return undefined;
  if (name.startsWith('@jsr/') && registry === NPM_REGISTRY) return undefined;
  const base = registry.endsWith('/') ? registry : `${registry}/`;
  return `${base}${name}/-/${name.replace(/^@[^/]+\//, '')}-${version}.tgz`;
}

/** Split `name@version`, where the name may be scoped. */
export function splitNameVersion(ident: string): [string, string] | undefined {
  const at = ident.indexOf('@', 1);
  if (at < 0) return undefined;
  return [ident.slice(0, at), ident.slice(at + 1)];
}

/** The package name at the end of a `node_modules/...` path. */
export function nameFromPath(path: string): string {
  return path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
}

/**
 * Find where `name` is installed for the package at `from` (a `node_modules/...`
 * path, or `''` for the project), the way Node resolves it: nested first, then
 * each ancestor, then the top level.
 */
export function findInstalled(from: string, name: string, has: (path: string) => boolean): string | undefined {
  let current = from;
  while (current) {
    const candidate = `${current}/node_modules/${name}`;
    if (has(candidate)) return candidate;
    const parent = current.replace(/\/?node_modules\/(@[^/]+\/)?[^/]+$/, '');
    if (parent === current) break;
    current = parent;
  }
  const top = `node_modules/${name}`;
  return has(top) ? top : undefined;
}

/** Deepest nesting allowed, as a guard against pathological graphs. */
const MAX_DEPTH = 64;

/**
 * Lay a dependency graph out as a node_modules tree, the way npm hoists:
 * each package goes at the top level unless something else already has that
 * name in its resolution path, in which case it nests under its dependent.
 *
 * Packages are placed breadth first, so by the time one nests a dependency,
 * nothing below it has resolved anything yet, and the nesting can't shadow a
 * resolution made earlier.
 */
export function layOut(graph: LockGraph): PackageLock {
  const packages: Record<string, LockPackage> = {};
  const placed = new Map<string, string>();
  const has = (path: string) => placed.has(path);
  const queue: string[] = [''];

  while (queue.length) {
    const parent = queue.shift()!;
    const dependencies = parent ? graph.nodes.get(placed.get(parent)!)!.dependencies : graph.root;
    if (parent.split('node_modules/').length > MAX_DEPTH) continue;

    for (const [alias, id] of Object.entries(dependencies)) {
      const node = graph.nodes.get(id);
      if (!node) continue;
      const found = findInstalled(parent, alias, has);
      if (found && placed.get(found) === id) continue;
      const path = found ? `${parent ? `${parent}/` : ''}node_modules/${alias}` : `node_modules/${alias}`;
      if (placed.has(path)) continue;

      placed.set(path, id);
      packages[path] = toLockPackage(node, graph);
      queue.push(path);
    }
  }

  return { packages };
}

function toLockPackage(node: LockNode, graph: LockGraph): LockPackage {
  const entry: LockPackage = { name: node.name, version: node.version };
  if (node.resolved) entry.resolved = node.resolved;
  if (node.integrity) entry.integrity = node.integrity;
  const deps = Object.entries(node.dependencies);
  if (deps.length) {
    entry.dependencies = Object.fromEntries(deps.map(([alias, id]) => [alias, graph.nodes.get(id)?.version ?? '*']));
  }
  if (node.peerDependencies && Object.keys(node.peerDependencies).length) {
    entry.peerDependencies = node.peerDependencies;
  }
  return entry;
}
