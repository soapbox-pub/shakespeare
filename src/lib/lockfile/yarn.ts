import { parse } from 'yaml';

import { layOut, splitNameVersion, tarballUrl, type LockGraph, type PackageLock } from './tree';

export interface RootManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

interface YarnEntry {
  version?: string;
  resolved?: string;
  integrity?: string;
  /** Berry only: `name@npm:1.2.3`. */
  resolution?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/**
 * Parse yarn.lock, from Yarn 1 or Yarn 2+ (Berry). Both map dependency
 * descriptors (`name@range`) to resolved packages, so the project's own
 * ranges are needed to find its direct dependencies; Berry records them in
 * the workspace entry, Yarn 1 doesn't.
 */
export function parseYarnLock(text: string, manifest: RootManifest = {}): PackageLock {
  const berry = /^__metadata:/m.test(text);
  const entries = berry ? parse(text) as Record<string, YarnEntry> : parseYarnV1(text);

  const graph: LockGraph = { root: {}, nodes: new Map() };
  /** Descriptor -> node id (the entry's first descriptor). */
  const descriptors = new Map<string, string>();
  let workspace: YarnEntry | undefined;

  for (const [key, entry] of Object.entries(entries)) {
    if (key === '__metadata' || !entry?.version) continue;
    const keys = key.split(/,\s*/).map((d) => d.trim().replace(/^"|"$/g, ''));
    if (berry && entry.resolution?.endsWith('@workspace:.')) {
      workspace = entry;
      continue;
    }

    const id = keys[0];
    for (const descriptor of keys) descriptors.set(descriptor, id);

    const name = realName(berry ? entry.resolution ?? id : id);
    if (!name) continue;
    graph.nodes.set(id, {
      name,
      version: entry.version,
      resolved: berry ? tarballUrl(name, entry.version) : cleanResolved(entry.resolved),
      integrity: entry.integrity,
      dependencies: { ...entry.dependencies, ...entry.optionalDependencies },
      peerDependencies: entry.peerDependencies,
    });
  }

  const lookup = (alias: string, range: string): string | undefined => {
    // Yarn patches some packages (typescript, resolve, fsevents); the unpatched package is close enough.
    const patch = range.match(/^patch:(.+?)(?:#|$)/);
    if (patch) return descriptors.get(decodeURIComponent(patch[1]));
    return descriptors.get(`${alias}@${range}`) ?? (berry ? descriptors.get(`${alias}@npm:${range}`) : undefined);
  };

  // Dependencies were recorded as ranges; point them at nodes.
  for (const node of graph.nodes.values()) {
    const resolved: Record<string, string> = {};
    for (const [alias, range] of Object.entries(node.dependencies)) {
      const target = lookup(alias, range);
      if (target) resolved[alias] = target;
    }
    node.dependencies = resolved;
  }

  const root = workspace ?? {
    dependencies: { ...manifest.dependencies, ...manifest.devDependencies, ...manifest.optionalDependencies },
  };
  for (const [alias, range] of Object.entries({ ...root.dependencies, ...root.optionalDependencies })) {
    const target = lookup(alias, range);
    if (target) graph.root[alias] = target;
  }

  return layOut(graph);
}

/**
 * The real package name for a descriptor or Berry resolution:
 * `foo@npm:bar@^1.0.0` -> `bar`, `foo@npm:1.2.3` -> `foo`, `foo@^1.0.0` -> `foo`.
 */
function realName(descriptor: string): string | undefined {
  const [alias, range] = splitNameVersion(descriptor) ?? [];
  if (!alias || range === undefined) return undefined;
  if (range.startsWith('npm:')) {
    const target = splitNameVersion(range.slice(4));
    if (target && !/^[\d^~<>=*]/.test(range.slice(4))) return target[0];
  }
  return alias;
}

/** Drop the `#sha1` fragment, and use the npm registry rather than Yarn's mirror of it. */
function cleanResolved(resolved: string | undefined): string | undefined {
  return resolved?.replace(/#.*$/, '').replace(/^https:\/\/registry\.yarnpkg\.com\//, 'https://registry.npmjs.org/');
}

/** Yarn 1's own format: indented `key value` pairs under `descriptor, descriptor:` headers. */
function parseYarnV1(text: string): Record<string, YarnEntry> {
  const entries: Record<string, YarnEntry> = {};
  let entry: YarnEntry | undefined;
  let block: Record<string, string> | undefined;

  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;

    if (indent === 0) {
      entry = {};
      block = undefined;
      entries[line.trim().replace(/:$/, '')] = entry;
      continue;
    }
    if (!entry) continue;

    const match = line.trim().match(/^("(?:[^"\\]|\\.)*"|\S+?)(:?)(?:\s+(.*))?$/);
    if (!match) continue;
    const key = unquote(match[1]);
    const value = match[3] !== undefined ? unquote(match[3]) : undefined;

    if (indent === 2) {
      block = undefined;
      if (value === undefined) {
        if (key === 'dependencies' || key === 'optionalDependencies' || key === 'peerDependencies') {
          block = entry[key] = {};
        }
      } else if (key === 'version' || key === 'resolved' || key === 'integrity') {
        entry[key] = value;
      }
    } else if (block && value !== undefined) {
      block[key] = value;
    }
  }
  return entries;
}

function unquote(value: string): string {
  return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}
