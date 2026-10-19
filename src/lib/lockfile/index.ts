import { parseBunLock } from './bun';
import { parseNpmLock } from './npm';
import { parsePnpmLock } from './pnpm';
import { parseYarnLock, type RootManifest } from './yarn';

import type { PackageLock } from './tree';

export type { LockPackage, PackageLock } from './tree';

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
