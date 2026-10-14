import semver from 'semver';

import { extractTarGz } from './tar';

/** An entry in package-lock.json's `packages` map. */
export interface LockEntry {
  name?: string;
  version?: string;
  resolved?: string;
  integrity?: string;
  link?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export interface PackageLock {
  packages?: Record<string, LockEntry>;
}

/** Where to download a package from. */
export interface PackageSource {
  resolved: string;
  integrity?: string;
}

/**
 * The files of a package that matter to the compiler. `files` holds the text of
 * declaration/source files and every package.json. `stubs` lists JavaScript files
 * by path only: TypeScript checks that they exist but never reads them unless
 * `allowJs` reaches into node_modules.
 */
export interface PackageFiles {
  files: Record<string, string>;
  stubs: string[];
}

export interface PackageCache {
  get(key: string): Promise<PackageFiles | undefined>;
  put(key: string, value: PackageFiles): Promise<void>;
}

const TYPE_FILE = /\.(d\.[mc]?ts|[mc]?ts|tsx)$/;
const JS_FILE = /\.([mc]?js|jsx)$/;

/** Keep what the type checker can read from a dependency. */
export function selectTypeFiles(path: string): 'text' | 'stub' | undefined {
  if (path === 'package.json' || path.endsWith('/package.json')) return 'text';
  if (TYPE_FILE.test(path)) return 'text';
  if (JS_FILE.test(path)) return 'stub';
  return undefined;
}

/** Keep the compiler itself and its standard library declarations. */
export function selectCompilerFiles(path: string): 'text' | 'stub' | undefined {
  if (path === 'package.json' || path === 'lib/typescript.js') return 'text';
  if (/^lib\/lib\.[^/]+\.d\.ts$/.test(path)) return 'text';
  return undefined;
}

async function verifyIntegrity(data: Uint8Array, integrity: string | undefined, url: string): Promise<void> {
  if (!integrity) return;
  for (const candidate of integrity.split(/\s+/)) {
    const match = candidate.match(/^(sha512|sha384|sha256|sha1)-(.+)$/);
    if (!match) continue;
    const algorithm = { sha512: 'SHA-512', sha384: 'SHA-384', sha256: 'SHA-256', sha1: 'SHA-1' }[match[1]]!;
    const digest = new Uint8Array(await crypto.subtle.digest(algorithm, data as BufferSource));
    let binary = '';
    for (const byte of digest) binary += String.fromCharCode(byte);
    if (btoa(binary) === match[2]) return;
    throw new Error(`integrity check failed for ${url}`);
  }
}

/** Download a tarball, verify it against the lockfile, and keep the selected files. */
export async function fetchPackage(
  source: PackageSource,
  select: (path: string) => 'text' | 'stub' | undefined,
): Promise<PackageFiles> {
  const response = await fetch(source.resolved);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} fetching ${source.resolved}`);
  }
  const data = new Uint8Array(await response.arrayBuffer());
  await verifyIntegrity(data, source.integrity, source.resolved);

  const decoder = new TextDecoder();
  const result: PackageFiles = { files: {}, stubs: [] };
  for (const entry of await extractTarGz(data)) {
    const kind = select(entry.path);
    if (kind === 'text') result.files[entry.path] = decoder.decode(entry.data);
    else if (kind === 'stub') result.stubs.push(entry.path);
  }
  return result;
}

function registryFor(name: string): string {
  return name.startsWith('@jsr/') ? 'https://npm.jsr.io' : 'https://registry.npmjs.org';
}

interface Packument {
  'dist-tags'?: Record<string, string>;
  versions?: Record<string, { dist?: { tarball?: string; integrity?: string } }>;
}

export interface ResolvedPackage extends PackageSource {
  name: string;
  version: string;
}

/**
 * Pick a version for `name` from the registry, the way `npm install` would for a
 * package.json range. Handles `npm:` aliases and dist-tags. Returns undefined for
 * specifiers that point outside a registry (git, file, workspace, ...).
 */
export function resolveFromRegistry(name: string, spec: string): Promise<ResolvedPackage | undefined> {
  const key = `${name}@${spec}`;
  let resolved = resolutions.get(key);
  if (!resolved) {
    resolved = resolve(name, spec);
    resolutions.set(key, resolved);
    resolved.catch(() => resolutions.delete(key));
  }
  return resolved;
}

const resolutions = new Map<string, Promise<ResolvedPackage | undefined>>();

async function resolve(name: string, spec: string): Promise<ResolvedPackage | undefined> {
  const alias = spec.match(/^npm:((?:@[^/@]+\/)?[^@]+)(?:@(.*))?$/);
  if (alias) {
    name = alias[1];
    spec = alias[2] || 'latest';
  }

  const isRange = semver.validRange(spec) !== null;
  if (!isRange && !/^[a-z][\w.-]*$/i.test(spec)) return undefined;

  const response = await fetch(`${registryFor(name)}/${name.replace('/', '%2f')}`, {
    headers: { Accept: 'application/vnd.npm.install-v1+json' },
  });
  if (!response.ok) return undefined;
  const packument: Packument = await response.json();
  const versions = Object.keys(packument.versions ?? {});

  const latest = packument['dist-tags']?.latest;
  const version = isRange
    ? (latest && semver.satisfies(latest, spec) ? latest : semver.maxSatisfying(versions, spec))
    : packument['dist-tags']?.[spec];
  const dist = version ? packument.versions?.[version]?.dist : undefined;
  if (!version || !dist?.tarball) return undefined;

  return { name, version, resolved: dist.tarball, integrity: dist.integrity };
}

/** In-memory cache in front of an optional persistent one. */
export class LayeredPackageCache implements PackageCache {
  private memory = new Map<string, PackageFiles>();

  constructor(private persistent?: PackageCache) {}

  async get(key: string): Promise<PackageFiles | undefined> {
    const hit = this.memory.get(key);
    if (hit) return hit;
    const stored = await this.persistent?.get(key).catch(() => undefined);
    if (stored) this.memory.set(key, stored);
    return stored;
  }

  async put(key: string, value: PackageFiles): Promise<void> {
    this.memory.set(key, value);
    await this.persistent?.put(key, value).catch(() => undefined);
  }
}

/** Package cache persisted in IndexedDB, so each tarball is downloaded once per browser. */
export class IndexedDBPackageCache implements PackageCache {
  private db: Promise<IDBDatabase>;

  constructor(name = 'shakespeare-tsc') {
    this.db = new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('packages');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async request<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const request = fn(db.transaction('packages', mode).objectStore('packages'));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  get(key: string): Promise<PackageFiles | undefined> {
    return this.request('readonly', (store) => store.get(key));
  }

  async put(key: string, value: PackageFiles): Promise<void> {
    await this.request('readwrite', (store) => store.put(value, key));
  }
}
