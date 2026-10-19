import semver from 'semver';

/** A version's entry in an abbreviated packument: what installing it needs. */
export interface Manifest {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  bundleDependencies?: string[] | boolean;
  bin?: Record<string, string>;
  engines?: Record<string, string>;
  os?: string[];
  cpu?: string[];
  libc?: string[];
  deprecated?: string;
  hasInstallScript?: boolean;
  dist: { tarball: string; integrity?: string; shasum?: string };
}

interface Packument {
  'dist-tags'?: Record<string, string>;
  versions?: Record<string, Manifest>;
}

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/';

/** A dependency specifier split into the package it names and the range or tag it asks for. */
export function parseSpec(alias: string, spec: string): { name: string; range: string } | undefined {
  const aliased = spec.match(/^npm:((?:@[^/@]+\/)?[^@]+)(?:@(.*))?$/);
  if (aliased) return { name: aliased[1], range: aliased[2] || '*' };
  // git, file, link, workspace, and URL specifiers don't come from a registry.
  if (/^[a-z+]+:|^[./~]|^[^@\s]+\/[^@\s]+$/i.test(spec)) return undefined;
  return { name: alias, range: spec.trim() || '*' };
}

/** Whether an installed version is acceptable for a range (or dist-tag, which can't be checked). */
export function satisfiesRange(version: string, range: string): boolean {
  if (semver.validRange(range, { loose: true }) === null) return true;
  return semver.satisfies(version, range, { loose: true });
}

/** Registry access the way npm sees it, including scoped registries from `.npmrc`. */
export class Registry {
  private registries = new Map<string, string>();
  private packuments = new Map<string, Promise<Packument | undefined>>();

  constructor(npmrc = '', private fetchFn: typeof fetch = (...args) => fetch(...args)) {
    this.registries.set('', DEFAULT_REGISTRY);
    this.registries.set('@jsr', 'https://npm.jsr.io/');
    for (const line of npmrc.split('\n')) {
      const match = line.trim().match(/^(@[^:\s]+:)?registry\s*=\s*["']?([^"'\s]+)/);
      if (match) {
        const url = match[2].endsWith('/') ? match[2] : `${match[2]}/`;
        this.registries.set(match[1]?.slice(0, -1) ?? '', url);
      }
    }
  }

  /** The registry a package is fetched from. */
  registryFor(name: string): string {
    const scope = name.startsWith('@') ? name.slice(0, name.indexOf('/')) : '';
    return this.registries.get(scope) ?? this.registries.get('')!;
  }

  isDefault(name: string): boolean {
    return this.registryFor(name) === DEFAULT_REGISTRY;
  }

  /** Fetch a package's abbreviated packument, once. */
  packument(name: string): Promise<Packument | undefined> {
    let packument = this.packuments.get(name);
    if (!packument) {
      packument = this.fetchPackument(name);
      this.packuments.set(name, packument);
      packument.catch(() => this.packuments.delete(name));
    }
    return packument;
  }

  private async fetchPackument(name: string): Promise<Packument | undefined> {
    const response = await this.fetchFn(`${this.registryFor(name)}${name.replace('/', '%2f')}`, {
      headers: { Accept: 'application/vnd.npm.install-v1+json' },
    });
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} fetching ${name} from the registry`);
    return response.json();
  }

  /**
   * Pick the version npm would install for a range: the `latest` tag if it
   * satisfies the range, otherwise the highest satisfying version, avoiding
   * deprecated ones. Dist-tags and exact versions are looked up directly.
   */
  async pick(name: string, range: string): Promise<Manifest | undefined> {
    const packument = await this.packument(name);
    const versions = packument?.versions ?? {};
    const tags = packument?.['dist-tags'] ?? {};

    let version: string | undefined;
    if (versions[range]) {
      version = range;
    } else if (semver.validRange(range, { loose: true }) === null) {
      version = tags[range];
    } else {
      const latest = tags.latest;
      if (latest && versions[latest] && semver.satisfies(latest, range, { loose: true })) {
        version = latest;
      } else {
        const candidates = Object.keys(versions).filter((v) => semver.satisfies(v, range, { loose: true }));
        const current = candidates.filter((v) => !versions[v].deprecated);
        version = semver.maxSatisfying(current.length ? current : candidates, range, { loose: true }) ?? undefined;
      }
    }

    const manifest = version ? versions[version] : undefined;
    if (!manifest?.dist?.tarball) return undefined;
    return { ...manifest, name };
  }
}

/** The manifest's integrity, falling back to the sha1 shasum old packages carry instead. */
export function integrityOf(manifest: Manifest): string | undefined {
  if (manifest.dist.integrity) return manifest.dist.integrity;
  const hex = manifest.dist.shasum;
  if (!hex || !/^[0-9a-f]{40}$/i.test(hex)) return undefined;
  let binary = '';
  for (let i = 0; i < hex.length; i += 2) binary += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  return `sha1-${btoa(binary)}`;
}

/** `bin` the way npm records it: an object, with paths relative and without `./`. */
export function normalizeBin(manifest: Manifest): Record<string, string> | undefined {
  const bin: unknown = manifest.bin;
  const entries: Array<[string, string]> = typeof bin === 'string'
    ? [[manifest.name.replace(/^@[^/]+\//, ''), bin]]
    : Object.entries((bin ?? {}) as Record<string, string>);
  if (!entries.length) return undefined;
  return Object.fromEntries(entries.map(([key, path]) => [key, path.replace(/^(\.\/)+/, '')]));
}
