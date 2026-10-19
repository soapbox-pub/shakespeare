import { parseBunLock, updateBunLock } from './bun';
import { parseNpmLock, updateNpmLock } from './npm';
import type { Registry } from './registry';
import { parsePnpmLock } from './pnpm';
import { parseYarnLock, type RootManifest } from './yarn';

import type { PackageLock } from './tree';

export type { LockPackage, PackageLock } from './tree';
export { Registry } from './registry';

/** Lockfiles in order of preference, when a project has more than one. */
export const LOCKFILES = ['package-lock.json', 'pnpm-lock.yaml', 'bun.lock', 'yarn.lock'] as const;

export type Lockfile = typeof LOCKFILES[number];

/**
 * Convert any supported lockfile into package-lock.json's `packages` layout,
 * which is what the build and the type checker read. Throws if it can't be parsed.
 */
export function parseLockfile(file: Lockfile, text: string, manifest?: RootManifest): PackageLock {
  switch (file) {
    case 'package-lock.json':
      return parseNpmLock(text);
    case 'pnpm-lock.yaml':
      return parsePnpmLock(text);
    case 'bun.lock':
      return parseBunLock(text);
    case 'yarn.lock':
      return parseYarnLock(text, manifest);
  }
}

export type LockfileUpdate =
  /** `warnings` lists peer dependency conflicts the change introduced. */
  | { file: Lockfile; text: string; warnings: string[] }
  /** The project's lockfile is in a format that can't be updated here. */
  | { file: Lockfile; unsupported: true };

/** Lockfiles that can be updated after a change to package.json. */
export const UPDATABLE_LOCKFILES: readonly Lockfile[] = ['package-lock.json', 'bun.lock'];

/**
 * Work out the project's lockfile after a change to package.json, fetching
 * new packages from `registry`. `read` returns a project file's text, or
 * undefined when it doesn't exist. Returns undefined for projects without a
 * lockfile, and throws if packages can't be resolved. Nothing is written.
 */
export async function updateLockfile(
  read: (file: Lockfile) => Promise<string | undefined> | string | undefined,
  manifest: Record<string, unknown>,
  registry: Registry,
): Promise<LockfileUpdate | undefined> {
  for (const file of LOCKFILES) {
    const text = await read(file);
    if (text === undefined) continue;
    if (file === 'package-lock.json') return { file, ...await updateNpmLock(text, manifest, registry) };
    if (file === 'bun.lock') return { file, ...await updateBunLock(text, manifest, registry) };
    return { file, unsupported: true };
  }
  return undefined;
}

/**
 * Find and parse the project's lockfile. `read` returns a file's text, or
 * undefined when it doesn't exist. A lockfile that fails to parse is reported
 * and skipped in favor of the next one.
 */
export async function readLockfile(
  read: (file: Lockfile) => Promise<string | undefined> | string | undefined,
  manifest?: RootManifest,
): Promise<{ file: Lockfile; lock: PackageLock } | undefined> {
  for (const file of LOCKFILES) {
    const text = await read(file);
    if (text === undefined) continue;
    try {
      return { file, lock: parseLockfile(file, text, manifest) };
    } catch (error) {
      console.warn(`Could not parse ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return undefined;
}
