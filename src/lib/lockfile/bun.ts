import * as JSONC from 'jsonc-parser';
import semver from 'semver';

import { installMissing, prune, setRootDependencies, stringMap, type Tree, type TreeEntry } from './install';
import { integrityOf, normalizeBin, type Manifest, type Registry } from './registry';
import { splitNameVersion, tarballUrl, type LockPackage, type PackageLock } from './tree';

interface BunInfo {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalPeers?: string[];
  bundled?: boolean;
  [key: string]: unknown;
}

/**
 * Parse bun.lock (the text lockfile of Bun 1.2+). Its `packages` keys are
 * already a node_modules layout: `a/b` is `b` nested under `a`.
 * The binary bun.lockb of older versions isn't supported.
 */
export function parseBunLock(text: string): PackageLock {
  const lock: { packages?: Record<string, unknown[]> } = JSONC.parse(text, [], { allowTrailingComma: true }) ?? {};
  const packages: Record<string, LockPackage> = {};

  for (const [key, value] of Object.entries(lock.packages ?? {})) {
    if (!Array.isArray(value) || typeof value[0] !== 'string') continue;
    const nameVersion = splitNameVersion(value[0]);
    if (!nameVersion) continue;
    const [name, version] = nameVersion;
    const path = keyToPath(key);

    // Registry packages: [ident, registry or tarball URL, info, integrity].
    // Everything else (workspace, link, file, git, tarball): [ident, info, ...].
    if (semver.valid(version)) {
      const source = typeof value[1] === 'string' ? value[1] : '';
      const info = (value[2] ?? {}) as BunInfo;
      packages[path] = {
        name,
        version,
        resolved: source.endsWith('.tgz') ? source : tarballUrl(name, version, source || undefined),
        integrity: typeof value[3] === 'string' ? value[3] : undefined,
        dependencies: { ...info.dependencies, ...info.optionalDependencies },
        peerDependencies: info.peerDependencies,
      };
    } else {
      const info = (typeof value[1] === 'object' ? value[1] : {}) as BunInfo;
      packages[path] = {
        name,
        version,
        link: /^(workspace|link|file):/.test(version) || undefined,
        dependencies: { ...info.dependencies, ...info.optionalDependencies },
        peerDependencies: info.peerDependencies,
      };
    }
  }

  return { packages };
}

/**
 * Bring bun.lock in line with package.json, as `bun install` would: install
 * what's missing from the registry and drop what's no longer needed.
 * Entries that don't change are written back exactly as they were.
 */
export async function updateBunLock(text: string, manifest: Record<string, unknown>, registry: Registry): Promise<{ text: string; warnings: string[] }> {
  const lock: Record<string, unknown> & {
    workspaces?: Record<string, Record<string, unknown>>;
    packages?: Record<string, unknown[]>;
  } = JSONC.parse(text, [], { allowTrailingComma: true }) ?? {};

  lock.workspaces = { ...lock.workspaces, '': updateWorkspace(lock.workspaces?.[''] ?? {}, manifest) };

  const tree: Tree = { '': {} };
  setRootDependencies(tree[''], manifest);
  for (const [key, value] of Object.entries(lock.packages ?? {})) {
    const entry = fromBun(value);
    if (entry) tree[keyToPath(key)] = entry;
  }

  const overrides = { ...stringMap(lock.overrides), ...stringMap(manifest.resolutions), ...stringMap(manifest.overrides) };
  const warnings = await installMissing(tree, registry, (_alias, pkg) => toBunEntry(pkg, registry), overrides);
  prune(tree);

  const paths = Object.keys(tree).filter(Boolean)
    .map((path) => ({ path, key: pathToKey(path), depth: path.split('node_modules/').length }))
    .sort((a, b) => a.depth - b.depth || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  lock.packages = Object.fromEntries(paths.map(({ path, key }) => [key, tree[path].bun as unknown[]]));

  return { text: stringifyBunLock(lock), warnings };
}

/** The project's entry under `workspaces`, with its dependencies taken from package.json. */
function updateWorkspace(old: Record<string, unknown>, manifest: Record<string, unknown>): Record<string, unknown> {
  const meta = (manifest.peerDependenciesMeta ?? {}) as Record<string, { optional?: boolean }>;
  const fields: Record<string, unknown> = {
    dependencies: manifest.dependencies,
    devDependencies: manifest.devDependencies,
    optionalDependencies: manifest.optionalDependencies,
    peerDependencies: manifest.peerDependencies,
    optionalPeers: Object.keys(meta).filter((name) => meta[name]?.optional).sort(),
  };

  const workspace: Record<string, unknown> = {};
  if (typeof manifest.name === 'string') workspace.name = manifest.name;
  for (const [key, value] of Object.entries(old)) {
    if (!(key in fields) && !(key in workspace)) workspace[key] = value;
  }
  for (const [key, value] of Object.entries(fields)) {
    if (value && typeof value === 'object' && Object.keys(value).length) workspace[key] = value;
  }
  return workspace;
}

/** A bun.lock package entry as a tree entry, keeping the original to write back. */
function fromBun(value: unknown[]): TreeEntry | undefined {
  if (!Array.isArray(value) || typeof value[0] !== 'string') return undefined;
  const [name, version] = splitNameVersion(value[0]) ?? [];
  if (!name || version === undefined) return undefined;

  const registry = semver.valid(version) !== null;
  const info = ((registry ? value[2] : value[1]) ?? {}) as BunInfo;
  const entry: TreeEntry = {
    name,
    version,
    dependencies: info.dependencies,
    optionalDependencies: info.optionalDependencies,
    peerDependencies: info.peerDependencies,
    peerDependenciesMeta: info.optionalPeers?.length
      ? Object.fromEntries(info.optionalPeers.map((peer) => [peer, { optional: true }]))
      : undefined,
    bun: value,
  };
  if (info.bundled) entry.inBundle = true;
  if (!registry && /^(workspace|link|file):/.test(version)) entry.link = true;
  return entry;
}

function toBunEntry(manifest: Manifest, registry: Registry): TreeEntry {
  const info: BunInfo = {};
  const set = (key: string, value: unknown) => {
    if (value === undefined) return;
    if (Array.isArray(value)) {
      if (!value.length) return;
      info[key] = value.length === 1 && (key === 'os' || key === 'cpu') ? value[0] : value;
    } else if (typeof value !== 'object' || Object.keys(value as object).length) {
      info[key] = value;
    }
  };
  const meta = manifest.peerDependenciesMeta ?? {};
  set('dependencies', manifest.dependencies);
  set('optionalDependencies', manifest.optionalDependencies);
  set('peerDependencies', manifest.peerDependencies);
  set('optionalPeers', Object.keys(manifest.peerDependencies ?? {}).filter((name) => meta[name]?.optional).sort());
  set('bin', normalizeBin(manifest));
  set('os', manifest.os);
  set('cpu', manifest.cpu);

  const source = registry.isDefault(manifest.name) ? '' : manifest.dist.tarball;
  return {
    name: manifest.name,
    version: manifest.version,
    dependencies: manifest.dependencies,
    optionalDependencies: manifest.optionalDependencies,
    peerDependencies: manifest.peerDependencies,
    peerDependenciesMeta: manifest.peerDependenciesMeta,
    bun: [`${manifest.name}@${manifest.version}`, source, info, integrityOf(manifest) ?? ''],
  };
}

/** Write bun.lock the way Bun formats it, so unchanged lines stay unchanged. */
export function stringifyBunLock(lock: Record<string, unknown>): string {
  const members = Object.entries(lock).map(([key, value]) => {
    if (key !== 'packages' || !value || typeof value !== 'object' || !Object.keys(value).length) {
      return `  ${JSON.stringify(key)}: ${block(value, 1)}`;
    }
    const entries = Object.entries(value).map(([name, entry]) => `    ${JSON.stringify(name)}: ${inline(entry)},`);
    return `  "packages": {\n${entries.join('\n\n')}\n  }`;
  });
  return `{\n${members.join(',\n')}\n}\n`;
}

/** Nested multi-line JSON, with a comma after every member. */
function block(value: unknown, depth: number): string {
  const indent = '  '.repeat(depth);
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    return `[\n${value.map((item) => `${indent}  ${block(item, depth + 1)},`).join('\n')}\n${indent}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) return '{}';
    return `{\n${entries.map(([key, item]) => `${indent}  ${JSON.stringify(key)}: ${block(item, depth + 1)},`).join('\n')}\n${indent}}`;
  }
  return JSON.stringify(value);
}

/** Single-line JSON, as package entries are written. */
function inline(value: unknown, key?: string): string {
  if (Array.isArray(value)) {
    const items = value.map((item) => inline(item));
    // Bun pads platform lists and gives them a trailing comma.
    if ((key === 'os' || key === 'cpu') && items.length) return `[ ${items.join(', ')}, ]`;
    return `[${items.join(', ')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) return '{}';
    return `{ ${entries.map(([k, item]) => `${JSON.stringify(k)}: ${inline(item, k)}`).join(', ')} }`;
  }
  return JSON.stringify(value);
}

/** `node_modules/@babel/core/node_modules/semver` -> `@babel/core/semver` */
function pathToKey(path: string): string {
  return path.split('/node_modules/').map((part) => part.replace(/^node_modules\//, '')).join('/');
}

/** `@babel/core/semver` -> `node_modules/@babel/core/node_modules/semver` */
function keyToPath(key: string): string {
  const segments = key.split('/');
  const names: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    names.push(segments[i].startsWith('@') ? `${segments[i]}/${segments[++i]}` : segments[i]);
  }
  return names.map((name) => `node_modules/${name}`).join('/');
}
