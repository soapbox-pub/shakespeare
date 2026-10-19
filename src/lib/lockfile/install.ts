import { findInstalled, nameFromPath } from './tree';
import { parseSpec, satisfiesRange, type Manifest, type Registry } from './registry';

/**
 * A node_modules layout being edited: package-lock.json's `packages`, or
 * bun.lock's converted to it. `''` is the project. Entries keep any fields
 * this module doesn't know about.
 */
export type Tree = Record<string, TreeEntry>;

export interface TreeEntry {
  name?: string;
  version?: string;
  link?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  dev?: boolean;
  optional?: boolean;
  devOptional?: boolean;
  peer?: boolean;
  inBundle?: boolean;
  [key: string]: unknown;
}

/** Flat `overrides` (npm) or `resolutions`: package name -> the specifier everything else gets. */
export type Overrides = Record<string, string>;

type EdgeType = 'prod' | 'dev' | 'optional' | 'peer' | 'peerOptional';

interface Edge {
  alias: string;
  spec: string;
  type: EdgeType;
}

/** The dependencies a package declares. Only the project has dev dependencies. */
export function edgesOf(path: string, entry: TreeEntry, overrides: Overrides = {}): Edge[] {
  const edges = new Map<string, Edge>();
  const add = (deps: Record<string, string> | undefined, type: EdgeType) => {
    for (const [alias, spec] of Object.entries(deps ?? {})) edges.set(alias, { alias, spec, type });
  };
  for (const [alias, spec] of Object.entries(entry.peerDependencies ?? {})) {
    edges.set(alias, { alias, spec, type: entry.peerDependenciesMeta?.[alias]?.optional ? 'peerOptional' : 'peer' });
  }
  add(entry.dependencies, 'prod');
  if (path === '') add(entry.devDependencies, 'dev');
  add(entry.optionalDependencies, 'optional');
  if (path !== '') {
    for (const edge of edges.values()) {
      const override = overrides[edge.alias];
      if (override !== undefined) edge.spec = override;
    }
  }
  return [...edges.values()];
}

function realName(path: string, entry: TreeEntry): string {
  return entry.name ?? nameFromPath(path);
}

/** Whether the package installed at `path` is acceptable for a dependency. */
function satisfies(path: string, entry: TreeEntry, edge: Edge): boolean {
  if (entry.link) return true;
  const wanted = parseSpec(edge.alias, edge.spec);
  // Packages from outside a registry are taken as they are.
  if (!wanted) return true;
  return realName(path, entry) === wanted.name && !!entry.version && satisfiesRange(entry.version, wanted.range);
}

/** The directory a package path's `node_modules` hangs from: its parent package, or the project. */
function levelOf(path: string): string {
  return path.replace(/\/?node_modules\/(@[^/]+\/)?[^/]+$/, '');
}

function slotAt(level: string, alias: string): string {
  return level ? `${level}/node_modules/${alias}` : `node_modules/${alias}`;
}

/** `path` and the packages it is nested in, deepest first, ending with the project. */
function ancestry(path: string): string[] {
  const levels = [path];
  while (levels[levels.length - 1]) levels.push(levelOf(levels[levels.length - 1]));
  return levels;
}

function isWithin(path: string, level: string): boolean {
  return level === '' || path === level || path.startsWith(`${level}/node_modules/`);
}

/** Remove a package and everything nested in it. */
function removeSubtree(tree: Tree, path: string): void {
  for (const key of Object.keys(tree)) {
    if (key === path || key.startsWith(`${path}/node_modules/`)) delete tree[key];
  }
}

/**
 * Whether putting `entry` in `slot` would change, for the worse, which
 * package something already in the tree resolves to.
 */
function wouldShadow(tree: Tree, level: string, slot: string, alias: string, entry: TreeEntry, overrides: Overrides): boolean {
  const has = (p: string) => p in tree;
  for (const [path, owner] of Object.entries(tree)) {
    if (!isWithin(path, level) || owner.link) continue;
    for (const edge of edgesOf(path, owner, overrides)) {
      if (edge.alias !== alias) continue;
      // Both levels are in `path`'s ancestry, so the longer one is nearer and still wins.
      const current = findInstalled(path, alias, has);
      if (current && levelOf(current).length > level.length) continue;
      if (!satisfies(slot, entry, edge)) return true;
    }
  }
  return false;
}

/**
 * Place a package for `from`'s dependency, as high up as it can go without
 * changing what anything else resolves to. Peers go beside their dependent.
 */
function place(tree: Tree, from: string, edge: Edge, entry: TreeEntry, overrides: Overrides): string {
  let levels = ancestry(from);
  if (edge.type === 'peer' && from) levels = levels.slice(1);

  // Levels nearer than an existing copy of the name would be shadowed by it.
  const open: string[] = [];
  for (const level of levels) {
    if (slotAt(level, edge.alias) in tree) break;
    open.push(level);
  }

  for (const level of [...open].reverse()) {
    const slot = slotAt(level, edge.alias);
    if (!wouldShadow(tree, level, slot, edge.alias, entry, overrides)) {
      tree[slot] = entry;
      return slot;
    }
  }

  // Take the nearest slot regardless, replacing what's there if need be.
  // Anything that relied on what it hides gets its own copy in the next pass.
  const slot = slotAt(open.length ? open[0] : levels[0], edge.alias);
  removeSubtree(tree, slot);
  tree[slot] = entry;
  return slot;
}

/** Concurrent registry requests. */
const CONCURRENCY = 16;
/** Passes over the tree before giving up on settling it. */
const MAX_PASSES = 50;

/**
 * Make every dependency in the tree resolve to an acceptable version,
 * adding packages from the registry where one doesn't. What's already
 * installed and acceptable stays, as with `npm install`.
 *
 * Missing peer dependencies are installed (as npm 7+ does); peers that are
 * present but unsatisfied are left alone, and returned as warnings when they
 * involve a package added here. Optional dependencies that can't be found
 * are skipped.
 */
export async function installMissing(
  tree: Tree,
  registry: Registry,
  toEntry: (alias: string, manifest: Manifest) => TreeEntry,
  overrides: Overrides = {},
): Promise<string[]> {
  const has = (p: string) => p in tree;
  const added = new Set<string>();
  // npm's `$name` refers to the project's own specifier for that package.
  const root = tree[''] ?? {};
  overrides = Object.fromEntries(Object.entries(overrides).map(([name, spec]) => {
    const ref = spec.startsWith('$') ? spec.slice(1) : undefined;
    return [name, ref ? root.dependencies?.[ref] ?? root.devDependencies?.[ref] ?? root.optionalDependencies?.[ref] ?? spec : spec];
  }));

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const wanted: Array<{ from: string; edge: Edge; name: string; range: string }> = [];
    const paths = Object.keys(tree).sort((a, b) => depth(a) - depth(b) || (a < b ? -1 : a > b ? 1 : 0));

    for (const path of paths) {
      const entry = tree[path];
      if (entry.link || entry.inBundle || (path && !path.includes('node_modules/'))) continue;
      for (const edge of edgesOf(path, entry, overrides)) {
        if (edge.type === 'peerOptional') continue;
        const found = findInstalled(path, edge.alias, has);
        if (found && (edge.type === 'peer' || satisfies(found, tree[found], edge))) continue;
        const spec = parseSpec(edge.alias, edge.spec);
        if (spec) wanted.push({ from: path, edge, ...spec });
      }
    }
    if (!wanted.length) return peerConflicts(tree, added, overrides);

    const picks = new Map<string, Promise<Manifest | undefined>>();
    const keys = [...new Set(wanted.map(({ name, range }) => `${name}@${range}`))];
    const queue = [...keys];
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length) {
        const key = queue.shift()!;
        const at = key.indexOf('@', 1);
        const pick = registry.pick(key.slice(0, at), key.slice(at + 1));
        picks.set(key, pick);
        await pick.catch(() => undefined);
      }
    }));

    for (const { from, edge, name, range } of wanted) {
      // An earlier placement in this pass may have taken care of it, or removed `from`.
      if (!(from in tree)) continue;
      const found = findInstalled(from, edge.alias, has);
      if (found && (edge.type === 'peer' || satisfies(found, tree[found], edge))) continue;

      const manifest = await picks.get(`${name}@${range}`)!.catch((error) => {
        if (edge.type === 'optional') return undefined;
        throw error;
      });
      if (!manifest) {
        if (edge.type === 'optional') continue;
        throw new Error(`No version of ${name} matches ${range}`);
      }
      added.add(place(tree, from, edge, toEntry(edge.alias, manifest), overrides));
    }
  }
  throw new Error('Dependency tree did not settle');
}

/** Unsatisfied peer dependencies of, or on, the packages in `added`. npm refuses to install these. */
function peerConflicts(tree: Tree, added: Set<string>, overrides: Overrides): string[] {
  const has = (p: string) => p in tree;
  const conflicts: string[] = [];
  for (const [path, entry] of Object.entries(tree)) {
    if (!path || entry.link) continue;
    for (const edge of edgesOf(path, entry, overrides)) {
      if (edge.type !== 'peer') continue;
      const found = findInstalled(path, edge.alias, has);
      if (!found || satisfies(found, tree[found], edge) || !(added.has(path) || added.has(found))) continue;
      const pkg = `${realName(path, entry)}@${entry.version}`;
      conflicts.push(`${pkg} wants ${edge.alias}@${edge.spec} as a peer, but ${tree[found].version} is installed`);
    }
  }
  return [...new Set(conflicts)];
}

function depth(path: string): number {
  return path ? path.split('node_modules/').length - 1 : 0;
}

/** Remove packages nothing depends on any more. Optional peers alone don't keep a package. */
export function prune(tree: Tree): void {
  const has = (p: string) => p in tree;
  const reached = new Set<string>();
  const queue = Object.keys(tree).filter((path) => !path.includes('node_modules/'));
  for (const path of queue) reached.add(path);

  while (queue.length) {
    const path = queue.shift()!;
    const entry = tree[path];
    if (entry.link && typeof entry.resolved === 'string' && entry.resolved in tree && !reached.has(entry.resolved)) {
      reached.add(entry.resolved);
      queue.push(entry.resolved);
    }
    for (const edge of edgesOf(path, entry)) {
      if (edge.type === 'peerOptional') continue;
      const found = findInstalled(path, edge.alias, has);
      if (found && !reached.has(found)) {
        reached.add(found);
        queue.push(found);
      }
    }
  }

  for (const path of Object.keys(tree)) {
    if (reached.has(path)) continue;
    // Bundled packages ship inside their parent's tarball.
    if (tree[path].inBundle && reached.has(levelOf(path))) continue;
    delete tree[path];
  }
}

export interface DepFlags {
  dev: boolean;
  optional: boolean;
  devOptional: boolean;
  peer: boolean;
}

/**
 * Work out which packages are only needed for development, only optionally,
 * or only as peers, the way npm does (arborist's calcDepFlags). `npm ci
 * --omit=dev` relies on these.
 */
export function depFlags(tree: Tree): Map<string, DepFlags> {
  const has = (p: string) => p in tree;
  const flags = new Map<string, DepFlags>();
  for (const path of Object.keys(tree)) {
    const top = !path.includes('node_modules/');
    flags.set(path, { dev: !top, optional: !top, devOptional: !top, peer: !top });
  }

  const queue = Object.keys(tree).filter((path) => !path.includes('node_modules/'));
  while (queue.length) {
    const path = queue.pop()!;
    const from = flags.get(path)!;
    for (const edge of edgesOf(path, tree[path])) {
      const found = findInstalled(path, edge.alias, has);
      if (!found) continue;
      const to = flags.get(found)!;
      const dev = edge.type === 'dev';
      const optional = edge.type === 'optional' || edge.type === 'peerOptional';
      const peer = edge.type === 'peer' || edge.type === 'peerOptional';
      let changed = false;
      if (to.dev && !from.dev && !dev) { to.dev = false; changed = true; }
      if (to.optional && !from.optional && !optional) { to.optional = false; changed = true; }
      if (to.devOptional && !from.devOptional && !from.dev && !from.optional && !dev && !optional) {
        to.devOptional = false;
        changed = true;
      }
      if (to.peer && !from.peer && !peer) { to.peer = false; changed = true; }
      if (changed) queue.push(found);
    }
  }

  for (const value of flags.values()) {
    if (value.devOptional && (value.dev || value.optional)) value.devOptional = false;
  }
  return flags;
}

/** Copy the project's dependency fields from package.json into its tree entry. */
export function setRootDependencies(root: TreeEntry, manifest: Record<string, unknown>): void {
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'peerDependenciesMeta']) {
    const value = manifest[field];
    if (value && typeof value === 'object' && Object.keys(value).length) root[field] = value;
    else delete root[field];
  }
}

/** The string-valued members of an object, such as the flat part of `overrides`. */
export function stringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).filter((e): e is [string, string] => typeof e[1] === 'string'));
}
