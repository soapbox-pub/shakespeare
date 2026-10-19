import * as JSONC from 'jsonc-parser';
import semver from 'semver';

import { splitNameVersion, tarballUrl, type LockPackage, type PackageLock } from './tree';

interface BunInfo {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
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

/** `@babel/core/semver` -> `node_modules/@babel/core/node_modules/semver` */
function keyToPath(key: string): string {
  const segments = key.split('/');
  const names: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    names.push(segments[i].startsWith('@') ? `${segments[i]}/${segments[++i]}` : segments[i]);
  }
  return names.map((name) => `node_modules/${name}`).join('/');
}
