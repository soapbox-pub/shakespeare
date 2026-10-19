import { parse } from 'yaml';

import { layOut, splitNameVersion, tarballUrl, type LockGraph, type LockNode, type PackageLock } from './tree';

type DependencyMap = Record<string, string | { version: string }>;

interface PackageInfo {
  name?: string;
  version?: string;
  resolution?: { integrity?: string; tarball?: string };
  peerDependencies?: Record<string, string>;
  // v6 keeps the resolved dependencies with the package; v9 moves them to `snapshots`.
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

interface Importer {
  dependencies?: DependencyMap;
  devDependencies?: DependencyMap;
  optionalDependencies?: DependencyMap;
}

interface PnpmLock extends Importer {
  lockfileVersion?: string | number;
  importers?: Record<string, Importer>;
  packages?: Record<string, PackageInfo>;
  snapshots?: Record<string, { dependencies?: Record<string, string>; optionalDependencies?: Record<string, string> }>;
}

/**
 * Parse pnpm-lock.yaml: lockfileVersion 9 (pnpm 9 and 10) and 6 (pnpm 8).
 * pnpm records a graph, keyed by name@version plus the peers each copy was
 * resolved with, so it is laid out as a node_modules tree here.
 */
export function parsePnpmLock(text: string): PackageLock {
  const lock: PnpmLock = parse(text) ?? {};
  const major = parseInt(String(lock.lockfileVersion ?? ''), 10);
  if (major !== 6 && major !== 9) {
    throw new Error(`unsupported pnpm-lock.yaml version ${lock.lockfileVersion}`);
  }
  const v6 = major === 6;

  /** The node id a dependency reference points to, or undefined for links and directories. */
  const refToId = (alias: string, ref: string): string | undefined => {
    if (/^(link|file|workspace):/.test(ref)) return undefined;
    if (v6) return ref.startsWith('/') ? ref : `/${alias}@${ref}`;
    // An alias records the real name: `string-width-cjs: string-width@4.2.3`.
    return /^(@[^/@]+\/)?[^@/:()]+@/.test(ref) ? ref : `${alias}@${ref}`;
  };

  const graph: LockGraph = { root: {}, nodes: new Map() };
  const snapshots = v6 ? lock.packages ?? {} : lock.snapshots ?? {};

  for (const [id, snapshot] of Object.entries(snapshots)) {
    // Peer resolutions are appended in parentheses: `react-dom@19.0.0(react@19.0.0)`.
    const base = id.replace(/\(.*$/, '');
    const info = (v6 ? snapshot as PackageInfo : lock.packages?.[base]) ?? {};
    const nameVersion = splitNameVersion(v6 ? base.slice(1) : base);
    if (!nameVersion) continue;
    const name = info.name ?? nameVersion[0];
    const version = info.version ?? nameVersion[1];

    const dependencies: Record<string, string> = {};
    for (const [alias, ref] of Object.entries({ ...snapshot.dependencies, ...snapshot.optionalDependencies })) {
      const target = refToId(alias, String(ref));
      if (target) dependencies[alias] = target;
    }

    const node: LockNode = {
      name,
      version,
      resolved: info.resolution?.tarball ?? tarballUrl(name, version),
      integrity: info.resolution?.integrity,
      dependencies,
      peerDependencies: info.peerDependencies,
    };
    graph.nodes.set(id, node);
  }

  const importer = lock.importers?.['.'] ?? lock;
  for (const group of [importer.dependencies, importer.devDependencies, importer.optionalDependencies]) {
    for (const [alias, value] of Object.entries(group ?? {})) {
      const target = refToId(alias, String(typeof value === 'object' ? value.version : value));
      if (target) graph.root[alias] = target;
    }
  }

  return layOut(graph);
}
