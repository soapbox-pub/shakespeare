import type TS from 'typescript';
import semver from 'semver';

import {
  fetchPackage,
  resolveFromRegistry,
  selectCompilerFiles,
  selectTypeFiles,
  type LockEntry,
  type PackageCache,
  type PackageFiles,
  type PackageLock,
  type PackageSource,
} from './packages';
import { normalizePath, VirtualFiles } from './VirtualFiles';

export type TypeScriptModule = typeof TS;

export interface TscRequest {
  /** Absolute path of the project (where package.json and package-lock.json live). */
  projectRoot: string;
  /** Absolute working directory of the command. */
  cwd: string;
  /** Command-line arguments, as for `tsc`. */
  args: string[];
  /** Snapshot of the project's files, keyed by absolute path. */
  files: Record<string, string>;
}

export interface TscResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  /** Files the compiler wrote (emit output, .tsbuildinfo), keyed by absolute path. */
  writes: Record<string, string>;
}

export interface TscEnvironment {
  cache: PackageCache;
  /** Turn the source of `lib/typescript.js` into the compiler module. */
  evaluateCompiler(source: string): TypeScriptModule;
}

/** Where the compiler's own lib.*.d.ts files are mounted. */
const COMPILER_DIR = '/.typescript';
/** TypeScript 7 is native code; the newest JavaScript compiler is 6.x. */
const FALLBACK_COMPILER_RANGE = '^6';
const MAX_ROUNDS = 20;
const CONCURRENCY = 8;

interface PackageJson extends LockEntry {
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

class ExitSignal {
  constructor(readonly code: number) {}
}

const compilers = new Map<string, Promise<TypeScriptModule>>();
/** Projects checked before by this worker. */
const checked = new Set<string>();

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift()!);
  }));
}

function parseJson<T>(text: string | undefined): T | undefined {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

async function loadPackage(
  cache: PackageCache,
  source: PackageSource,
  kind: 'types' | 'compiler',
): Promise<PackageFiles> {
  const key = `${kind}:${source.resolved}`;
  const cached = await cache.get(key);
  if (cached) return cached;
  const pkg = await fetchPackage(source, kind === 'types' ? selectTypeFiles : selectCompilerFiles);
  await cache.put(key, pkg);
  return pkg;
}

/** Find the compiler to run: the project's own, unless it can't run in a browser. */
async function chooseCompiler(
  lock: PackageLock | undefined,
  declared: string | undefined,
  notes: string[],
): Promise<PackageSource & { version: string }> {
  const locked = lock?.packages?.['node_modules/typescript'];
  if (locked?.resolved && locked.version && semver.major(locked.version) < 7) {
    return { resolved: locked.resolved, integrity: locked.integrity, version: locked.version };
  }

  const declaredMin = declared && semver.validRange(declared) ? semver.minVersion(declared) : null;
  const range = declaredMin && declaredMin.major < 7 ? declared! : FALLBACK_COMPILER_RANGE;
  const version = locked?.version ?? declaredMin?.version;
  if (version && semver.major(version) >= 7) {
    notes.push(`tsc: TypeScript ${version} is native code and can't run in the browser; checking with TypeScript ${FALLBACK_COMPILER_RANGE.slice(1)}.x instead.`);
  }

  const resolved = await resolveFromRegistry('typescript', range);
  if (!resolved) throw new Error(`could not find a TypeScript release matching ${range}`);
  return resolved;
}

export async function runTsc(request: TscRequest, env: TscEnvironment): Promise<TscResult> {
  const { projectRoot: root, cwd, args, files } = request;
  const notes: string[] = [];

  const lock = parseJson<PackageLock>(files[`${root}/package-lock.json`]);
  const rootPackage = parseJson<LockEntry>(files[`${root}/package.json`]) ?? {};
  const declaredTs = rootPackage.devDependencies?.typescript ?? rootPackage.dependencies?.typescript;

  const compilerSource = await chooseCompiler(lock, declaredTs, notes);
  let compiler = compilers.get(compilerSource.resolved);
  if (!compiler) {
    compiler = loadPackage(env.cache, compilerSource, 'compiler')
      .then((pkg) => env.evaluateCompiler(pkg.files['lib/typescript.js']));
    compilers.set(compilerSource.resolved, compiler);
    compiler.catch(() => compilers.delete(compilerSource.resolved));
  }
  const ts = await compiler;
  const compilerPackage = await loadPackage(env.cache, compilerSource, 'compiler');

  const vfs = new VirtualFiles(root);
  for (const [path, text] of Object.entries(files)) vfs.writeFile(path, text);
  vfs.mount(COMPILER_DIR, { files: Object.fromEntries(Object.entries(compilerPackage.files).filter(([p]) => p.endsWith('.d.ts'))), stubs: [] });

  // Without it, the compiler never looks inside for packages the lockfile lacks.
  vfs.createDirectory(`${root}/node_modules`);

  const lockEntries = new Map<string, LockEntry>();
  for (const [key, entry] of Object.entries(lock?.packages ?? {})) {
    if (!key.startsWith('node_modules/') || entry.link || !entry.resolved) continue;
    lockEntries.set(key, entry);
    vfs.addLazyPackage(key);
  }

  const attempted = new Set<string>();

  /**
   * Find the range a package.json asks for, for a package the lockfile lacks
   * (npm_add_package records only the top-level package in the lockfile).
   * Like npm, this skips optional peer dependencies.
   */
  const declaredRange = (name: string): string | undefined => {
    const fromRoot = rootPackage.dependencies?.[name] ?? rootPackage.devDependencies?.[name];
    if (fromRoot) return fromRoot;
    for (const key of vfs.mountedKeys()) {
      const pkg = parseJson<PackageJson>(vfs.readFile(`${root}/${key}/package.json`));
      const range = pkg?.dependencies?.[name]
        ?? (pkg?.peerDependenciesMeta?.[name]?.optional ? undefined : pkg?.peerDependencies?.[name]);
      if (range) return range;
    }
    return undefined;
  };

  /** Download what the last compiler run asked for. Returns how many packages were added. */
  const install = async (keys: string[]): Promise<number> => {
    let added = 0;
    const jobs: Array<{ key: string; source: () => Promise<PackageSource | undefined> }> = [];

    for (const key of keys) {
      if (attempted.has(key) || vfs.isMounted(key)) continue;
      attempted.add(key);
      const entry = lockEntries.get(key);
      if (entry?.resolved) {
        jobs.push({ key, source: async () => ({ resolved: entry.resolved!, integrity: entry.integrity }) });
      }
    }

    for (const name of vfs.missing) {
      const key = `node_modules/${name}`;
      if (attempted.has(key) || vfs.isMounted(key)) continue;
      const range = declaredRange(name);
      if (!range) continue;
      attempted.add(key);
      jobs.push({ key, source: () => resolveFromRegistry(name, range) });
    }

    await mapLimit(jobs, CONCURRENCY, async ({ key, source }) => {
      try {
        const resolved = await source();
        if (!resolved) return;
        vfs.mount(`${root}/${key}`, await loadPackage(env.cache, resolved, 'types'), key);
        added++;
      } catch (error) {
        notes.push(`tsc: could not fetch ${key.replace(/^.*node_modules\//, '')}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    return added;
  };

  const run = async (argv: string[]): Promise<Omit<TscResult, 'stderr'>> => {
    vfs.wanted.clear();
    vfs.missing.clear();

    let stdout = '';
    let exitCode = 0;
    const writes: Record<string, string> = {};

    // getEnvironmentVariable and now are part of the internal System interface.
    const sys: TS.System & { getEnvironmentVariable(name: string): string; now(): Date } = {
      args: argv,
      newLine: '\n',
      useCaseSensitiveFileNames: true,
      write: (s) => { stdout += s; },
      writeOutputIsTTY: () => false,
      getWidthOfTerminal: () => 100,
      // Writes stay in an overlay, so a rerun sees the project as it was.
      readFile: (path) => {
        const abs = normalizePath(path, cwd);
        return abs in writes ? writes[abs] : vfs.readFile(abs);
      },
      getFileSize: (path) => vfs.getFileSize(normalizePath(path, cwd)),
      writeFile: (path, data) => { writes[normalizePath(path, cwd)] = data; },
      resolvePath: (path) => normalizePath(path, cwd),
      fileExists: (path) => {
        const abs = normalizePath(path, cwd);
        return abs in writes || vfs.fileExists(abs);
      },
      directoryExists: (path) => vfs.directoryExists(normalizePath(path, cwd)),
      createDirectory: (path) => vfs.createDirectory(normalizePath(path, cwd)),
      getExecutingFilePath: () => `${COMPILER_DIR}/lib/tsc.js`,
      getCurrentDirectory: () => cwd,
      getDirectories: (path) => vfs.getDirectories(normalizePath(path, cwd)),
      readDirectory: (path, extensions, excludes, includes, depth) => {
        // matchFiles is internal API, but it's how ts.sys implements this.
        const matchFiles = (ts as unknown as { matchFiles: MatchFiles }).matchFiles;
        return matchFiles(path, extensions, excludes, includes, true, cwd, depth, (dir) => vfs.getEntries(normalizePath(dir, cwd)), (p) => p);
      },
      realpath: (path) => normalizePath(path, cwd),
      getEnvironmentVariable: () => '',
      now: () => new Date(),
      exit: (code) => { throw new ExitSignal(code ?? 0); },
    };

    try {
      const executeCommandLine = (ts as unknown as { executeCommandLine: ExecuteCommandLine }).executeCommandLine;
      await executeCommandLine(sys, () => {}, argv);
    } catch (error) {
      if (!(error instanceof ExitSignal)) throw error;
      exitCode = error.code;
    }

    return { stdout, exitCode, writes };
  };

  /** Run with --listFilesOnly (no type checking) until every package the program reaches is present. */
  const discover = async () => {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      await run([...args, '--listFilesOnly']);
      if (!(await install([...vfs.wanted]))) return;
    }
  };

  // Anything downloaded before is cheap to mount, and saves discovery rounds.
  await Promise.all([...lockEntries].map(async ([key, entry]) => {
    const pkg = await env.cache.get(`types:${entry.resolved}`);
    if (pkg) vfs.mount(`${root}/${key}`, pkg, key);
  }));

  // On a project checked before, assume nothing is missing and check straight away.
  if (!checked.has(root)) await discover();

  let result = await run(args);
  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (!(await install([...vfs.wanted]))) break;
    await discover();
    result = await run(args);
  }

  checked.add(root);
  return { ...result, stderr: notes.join('\n') };
}

type MatchFiles = (
  path: string,
  extensions: readonly string[] | undefined,
  excludes: readonly string[] | undefined,
  includes: readonly string[] | undefined,
  useCaseSensitiveFileNames: boolean,
  currentDirectory: string,
  depth: number | undefined,
  getFileSystemEntries: (path: string) => { files: readonly string[]; directories: readonly string[] },
  realpath: (path: string) => string,
) => string[];

type ExecuteCommandLine = (system: TS.System, cb: () => void, args: readonly string[]) => unknown;
