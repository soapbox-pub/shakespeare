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
import { LOCKFILES, readLockfile } from '../lockfile';

export type TypeScriptModule = typeof TS;

export interface TscRequest {
  /** Absolute path of the project (where package.json and the lockfile live). */
  projectRoot: string;
  /** Absolute working directory of the command. */
  cwd: string;
  /** Command-line arguments, as for `tsc`. */
  args: string[];
  /** Project files added or changed since the last request, keyed by absolute path. */
  changed: Record<string, string>;
  /** Project files deleted since the last request. */
  removed: string[];
  /** `changed` holds the whole project rather than changes. */
  full: boolean;
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
/** Projects kept in memory. Each holds a whole program, so keep few. */
const MAX_PROJECTS = 2;
/** Sets of compiler options to keep parsed files for, per compiler. */
const MAX_OPTION_SETS = 4;
/** Command-line options the incremental path handles itself. */
const CHECK_OPTIONS = new Set(['project', 'noEmit', 'pretty']);
/** Options that don't affect parsing. */
const OUTPUT_OPTIONS = new Set(['configFile', 'project', 'pretty']);

interface PackageJson extends LockEntry {
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

/**
 * Compiler internals. The `tsc` CLI is assembled from these, so using them
 * keeps output and exit codes identical to it.
 */
interface Internals {
  matchFiles(
    path: string,
    extensions: readonly string[] | undefined,
    excludes: readonly string[] | undefined,
    includes: readonly string[] | undefined,
    useCaseSensitiveFileNames: boolean,
    currentDirectory: string,
    depth: number | undefined,
    getFileSystemEntries: (path: string) => { files: readonly string[]; directories: readonly string[] },
    realpath: (path: string) => string,
  ): string[];
  executeCommandLine(system: TS.System, cb: () => void, args: readonly string[]): unknown;
  convertToOptionsWithAbsolutePaths(options: TS.CompilerOptions, toAbsolutePath: (path: string) => string): TS.CompilerOptions;
  parseConfigFileWithSystem(
    configFileName: string,
    optionsToExtend: TS.CompilerOptions,
    extendedConfigCache: Map<string, unknown> | undefined,
    watchOptionsToExtend: TS.WatchOptions | undefined,
    system: TS.System,
    reportDiagnostic: TS.DiagnosticReporter,
  ): TS.ParsedCommandLine | undefined;
  createCompilerHostWorker(options: TS.CompilerOptions, setParentNodes: boolean | undefined, system: TS.System): TS.CompilerHost;
  createDiagnosticReporter(system: TS.System, pretty?: boolean): TS.DiagnosticReporter;
  emitFilesAndReportErrorsAndGetExitStatus(
    program: TS.BuilderProgram,
    reportDiagnostic: TS.DiagnosticReporter,
    write: (s: string) => void,
    reportSummary?: (errorCount: number, filesInError: unknown[]) => void,
  ): number;
  getErrorSummaryText(errorCount: number, filesInError: unknown[], newLine: string, host: TS.System): string;
}

interface CachedSourceFile {
  text: string;
  format: string;
  file: TS.SourceFile;
}

interface Compiler {
  ts: TypeScriptModule;
  libs: PackageFiles;
  /**
   * Parsed source files by compiler options, then path. Programs share them,
   * so a file is parsed and bound once until its text changes.
   */
  sourceFiles: Map<string, Map<string, CachedSourceFile>>;
  /**
   * Version of each file's text. The builder rechecks a file whose version
   * changed, so a file parsed again with the same text keeps its version.
   */
  versions: Map<string, { text: string; version: string }>;
  nextVersion: number;
}

class ExitSignal {
  constructor(readonly code: number) {}
}

const compilers = new Map<string, Promise<Compiler>>();

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

function loadCompiler(source: PackageSource, env: TscEnvironment): Promise<Compiler> {
  let compiler = compilers.get(source.resolved);
  if (!compiler) {
    compiler = loadPackage(env.cache, source, 'compiler').then((pkg) => ({
      ts: env.evaluateCompiler(pkg.files['lib/typescript.js']),
      libs: { files: Object.fromEntries(Object.entries(pkg.files).filter(([p]) => p.endsWith('.d.ts'))), stubs: [] },
      sourceFiles: new Map(),
      versions: new Map(),
      nextVersion: 0,
    }));
    compilers.set(source.resolved, compiler);
    compiler.catch(() => compilers.delete(source.resolved));
  }
  return compiler;
}

/** Whether the parsed config asks for nothing but a type check. */
function isPlainCheck(config: TS.ParsedCommandLine): boolean {
  const { options } = config;
  return options.noEmit === true
    && !config.projectReferences?.length
    && !options.watch && !options.listFilesOnly && !options.explainFiles
    && !options.diagnostics && !options.extendedDiagnostics
    && !options.generateTrace && !options.generateCpuProfile;
}

/**
 * The compiler state for one project: its files, the packages mounted so far,
 * and the last program, which the next type check builds on.
 */
class Session {
  readonly vfs: VirtualFiles;
  private lockEntries = new Map<string, LockEntry>();
  private attempted = new Set<string>();
  private program?: TS.Program;
  private builder?: TS.SemanticDiagnosticsBuilderProgram;
  /** Files were added or removed, or packages mounted, since `program` was made. */
  private structureChanged = true;
  private discovered = false;

  private constructor(
    readonly root: string,
    readonly key: string,
    readonly compiler: Compiler,
    private rootPackage: PackageJson,
    private env: TscEnvironment,
  ) {
    this.vfs = new VirtualFiles(root);
  }

  static async create(options: {
    root: string;
    key: string;
    compiler: Compiler;
    lock?: PackageLock;
    rootPackage: PackageJson;
    files: Map<string, string>;
    env: TscEnvironment;
    previous?: Session;
  }): Promise<Session> {
    const { root, compiler, lock, env, previous } = options;
    const session = new Session(root, options.key, compiler, options.rootPackage, env);
    const { vfs } = session;

    vfs.mount(COMPILER_DIR, compiler.libs);
    // Without it, the compiler never looks inside for packages the lockfile lacks.
    vfs.createDirectory(`${root}/node_modules`);

    for (const [key, entry] of Object.entries(lock?.packages ?? {})) {
      // Without a tarball URL (JSR packages, from some lockfiles), the version is looked up in the registry.
      if (!key.startsWith('node_modules/') || entry.link || !(entry.resolved || entry.version)) continue;
      session.lockEntries.set(key, entry);
      vfs.addLazyPackage(key);
    }

    // Anything downloaded before is cheap to mount, and saves discovery rounds.
    await Promise.all([...session.lockEntries].map(async ([key, entry]) => {
      if (!entry.resolved) return;
      const pkg = await env.cache.get(`types:${entry.resolved}`);
      if (pkg) vfs.mount(`${root}/${key}`, pkg, key);
    }));

    for (const [path, text] of options.files) vfs.writeFile(path, text);

    // The builder carries over, so only files that changed are checked again.
    if (previous?.compiler === compiler) session.builder = previous.builder;
    return session;
  }

  update(changed: Record<string, string>, removed: string[]): void {
    for (const path of removed) {
      this.vfs.deleteFile(path);
      this.structureChanged = true;
    }
    for (const [path, text] of Object.entries(changed)) {
      if (!this.vfs.fileExists(path)) this.structureChanged = true;
      this.vfs.writeFile(path, text);
    }
  }

  async run(cwd: string, args: string[], notes: string[]): Promise<Omit<TscResult, 'stderr'>> {
    return await this.check(cwd, args, notes) ?? await this.execute(cwd, args, notes);
  }

  private createSystem(argv: string[], cwd: string, output: string[], writes?: Record<string, string>) {
    const { vfs } = this;
    const resolve = (path: string) => normalizePath(path, cwd);
    const internals = this.compiler.ts as unknown as Internals;

    // getEnvironmentVariable and now are part of the internal System interface.
    const sys: TS.System & { getEnvironmentVariable(name: string): string; now(): Date } = {
      args: argv,
      newLine: '\n',
      useCaseSensitiveFileNames: true,
      write: (s) => { output.push(s); },
      writeOutputIsTTY: () => false,
      getWidthOfTerminal: () => 100,
      // Writes stay in an overlay, so a rerun sees the project as it was.
      readFile: (path) => {
        const abs = resolve(path);
        return writes && abs in writes ? writes[abs] : vfs.readFile(abs);
      },
      getFileSize: (path) => vfs.getFileSize(resolve(path)),
      writeFile: (path, data) => {
        if (writes) writes[resolve(path)] = data;
      },
      resolvePath: resolve,
      fileExists: (path) => {
        const abs = resolve(path);
        return (writes !== undefined && abs in writes) || vfs.fileExists(abs);
      },
      directoryExists: (path) => vfs.directoryExists(resolve(path)),
      createDirectory: (path) => vfs.createDirectory(resolve(path)),
      getExecutingFilePath: () => `${COMPILER_DIR}/lib/tsc.js`,
      getCurrentDirectory: () => cwd,
      getDirectories: (path) => vfs.getDirectories(resolve(path)),
      readDirectory: (path, extensions, excludes, includes, depth) => internals.matchFiles(
        path, extensions, excludes, includes, true, cwd, depth, (dir) => vfs.getEntries(resolve(dir)), (p) => p,
      ),
      realpath: resolve,
      getEnvironmentVariable: () => '',
      now: () => new Date(),
      exit: (code) => { throw new ExitSignal(code ?? 0); },
    };
    return sys;
  }

  /** A compiler host whose source files come from the shared parse cache. */
  private createHost(options: TS.CompilerOptions, sys: TS.System): TS.CompilerHost {
    const { compiler } = this;
    const { ts } = compiler;
    const host = (ts as unknown as Internals).createCompilerHostWorker(options, undefined, sys);
    host.jsDocParsingMode = ts.JSDocParsingMode?.ParseForTypeErrors;

    const optionsKey = JSON.stringify(options, (key, value) => OUTPUT_OPTIONS.has(key) ? undefined : value);
    let cache = compiler.sourceFiles.get(optionsKey);
    if (!cache) {
      cache = new Map();
      compiler.sourceFiles.set(optionsKey, cache);
      while (compiler.sourceFiles.size > MAX_OPTION_SETS) {
        compiler.sourceFiles.delete(compiler.sourceFiles.keys().next().value!);
      }
    }

    const getSourceFile = host.getSourceFile;
    host.getSourceFile = (fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile) => {
      const text = sys.readFile(fileName);
      if (text === undefined) return getSourceFile.call(host, fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile);

      const format = typeof languageVersionOrOptions === 'object'
        ? `${languageVersionOrOptions.languageVersion}/${languageVersionOrOptions.impliedNodeFormat}/${languageVersionOrOptions.jsDocParsingMode}`
        : String(languageVersionOrOptions);
      const cached = cache.get(fileName);
      if (cached && cached.text === text && cached.format === format && !shouldCreateNewSourceFile) return cached.file;

      const file = getSourceFile.call(host, fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile);
      if (file) {
        let version = compiler.versions.get(fileName);
        if (version?.text !== text) {
          version = { text, version: String(compiler.nextVersion++) };
          compiler.versions.set(fileName, version);
        }
        (file as TS.SourceFile & { version: string }).version = version.version;
        cache.set(fileName, { text, format, file });
      }
      return file;
    };
    return host;
  }

  /**
   * Type check the project incrementally, building on the last program.
   * Returns undefined when the command asks for more than a type check.
   */
  private async check(cwd: string, args: string[], notes: string[]): Promise<Omit<TscResult, 'stderr'> | undefined> {
    const { ts } = this.compiler;
    const internals = ts as unknown as Internals;

    const commandLine = ts.parseCommandLine(args);
    if (
      commandLine.errors.length || commandLine.fileNames.length || commandLine.watchOptions
      || Object.keys(commandLine.options).some((option) => !CHECK_OPTIONS.has(option))
    ) {
      return undefined;
    }

    for (let round = 0; ; round++) {
      const output: string[] = [];
      const sys = this.createSystem(args, cwd, output);
      const canInstall = round < MAX_ROUNDS;
      this.vfs.wanted.clear();
      this.vfs.missing.clear();

      const configFileName = this.findConfig(ts, sys, commandLine.options.project);
      if (!configFileName) return undefined;
      const options = internals.convertToOptionsWithAbsolutePaths(commandLine.options, (path) => normalizePath(path, cwd));
      const config = internals.parseConfigFileWithSystem(
        configFileName, options, new Map(), undefined, sys, internals.createDiagnosticReporter(sys),
      );
      // The config may extend one from a package.
      if (canInstall && await this.install(notes)) continue;
      if (!config || !isPlainCheck(config)) return undefined;

      const host = this.createHost(config.options, sys);
      const configFileParsingDiagnostics = ts.getConfigFileParsingDiagnostics(config);
      const program = ts.createProgram({
        rootNames: config.fileNames,
        options: config.options,
        projectReferences: config.projectReferences,
        host,
        configFileParsingDiagnostics,
        oldProgram: this.structureChanged ? undefined : this.program,
      });
      if (canInstall && await this.install(notes)) continue;

      const builder = ts.createSemanticDiagnosticsBuilderProgram(program, host, this.builder, configFileParsingDiagnostics);
      const exitCode = internals.emitFilesAndReportErrorsAndGetExitStatus(
        builder,
        internals.createDiagnosticReporter(sys, config.options.pretty === true),
        (s) => sys.write(s + sys.newLine),
        config.options.pretty
          ? (errorCount, filesInError) => sys.write(internals.getErrorSummaryText(errorCount, filesInError, sys.newLine, sys))
          : undefined,
      );

      this.program = program;
      this.builder = builder;
      this.structureChanged = false;
      this.discovered = true;
      return { stdout: output.join(''), exitCode, writes: {} };
    }
  }

  /** Find tsconfig.json the way tsc does. Errors are left for the CLI to report. */
  private findConfig(ts: TypeScriptModule, sys: TS.System, project: string | undefined): string | undefined {
    if (project === undefined) return ts.findConfigFile(sys.getCurrentDirectory(), sys.fileExists);
    const path = sys.resolvePath(project);
    if (sys.directoryExists(path)) {
      const file = `${path}/tsconfig.json`;
      return sys.fileExists(file) ? file : undefined;
    }
    return sys.fileExists(path) ? path : undefined;
  }

  /** Run the tsc CLI from scratch, for anything other than a plain type check. */
  private async execute(cwd: string, args: string[], notes: string[]): Promise<Omit<TscResult, 'stderr'>> {
    const internals = this.compiler.ts as unknown as Internals;

    const run = async (argv: string[]): Promise<Omit<TscResult, 'stderr'>> => {
      this.vfs.wanted.clear();
      this.vfs.missing.clear();
      const output: string[] = [];
      const writes: Record<string, string> = {};
      let exitCode = 0;
      try {
        await internals.executeCommandLine(this.createSystem(argv, cwd, output, writes), () => {}, argv);
      } catch (error) {
        if (!(error instanceof ExitSignal)) throw error;
        exitCode = error.code;
      }
      return { stdout: output.join(''), exitCode, writes };
    };

    /** Run with --listFilesOnly (no type checking) until every package the program reaches is present. */
    const discover = async () => {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        await run([...args, '--listFilesOnly']);
        if (!(await this.install(notes))) return;
      }
    };

    if (!this.discovered) await discover();

    let result = await run(args);
    for (let round = 0; round < MAX_ROUNDS; round++) {
      if (!(await this.install(notes))) break;
      await discover();
      result = await run(args);
    }

    this.discovered = true;
    return result;
  }

  /**
   * Find the range a package.json asks for, for a package the lockfile lacks
   * (a stale lockfile, or one that couldn't be updated, like pnpm's).
   * Like npm, this skips optional peer dependencies.
   */
  private declaredRange(name: string): string | undefined {
    const fromRoot = this.rootPackage.dependencies?.[name] ?? this.rootPackage.devDependencies?.[name];
    if (fromRoot) return fromRoot;
    for (const key of this.vfs.mountedKeys()) {
      const pkg = parseJson<PackageJson>(this.vfs.readFile(`${this.root}/${key}/package.json`));
      const range = pkg?.dependencies?.[name]
        ?? (pkg?.peerDependenciesMeta?.[name]?.optional ? undefined : pkg?.peerDependencies?.[name]);
      if (range) return range;
    }
    return undefined;
  }

  /** Download what the last compiler run asked for. Returns how many packages were added. */
  private async install(notes: string[]): Promise<number> {
    const { vfs, attempted } = this;
    let added = 0;
    const jobs: Array<{ key: string; source: () => Promise<PackageSource | undefined> }> = [];

    for (const key of vfs.wanted) {
      if (attempted.has(key) || vfs.isMounted(key)) continue;
      attempted.add(key);
      const entry = this.lockEntries.get(key);
      if (entry?.resolved) {
        jobs.push({ key, source: async () => ({ resolved: entry.resolved!, integrity: entry.integrity }) });
      } else if (entry?.version) {
        const name = entry.name ?? key.replace(/^.*node_modules\//, '');
        jobs.push({ key, source: () => resolveFromRegistry(name, entry.version!) });
      }
    }

    for (const name of vfs.missing) {
      const key = `node_modules/${name}`;
      if (attempted.has(key) || vfs.isMounted(key)) continue;
      const range = this.declaredRange(name);
      if (!range) continue;
      attempted.add(key);
      jobs.push({ key, source: () => resolveFromRegistry(name, range) });
    }

    await mapLimit(jobs, CONCURRENCY, async ({ key, source }) => {
      try {
        const resolved = await source();
        if (!resolved) return;
        vfs.mount(`${this.root}/${key}`, await loadPackage(this.env.cache, resolved, 'types'), key);
        added++;
      } catch (error) {
        notes.push(`tsc: could not fetch ${key.replace(/^.*node_modules\//, '')}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    if (added) this.structureChanged = true;
    return added;
  }
}

interface Project {
  files: Map<string, string>;
  session?: Session;
  /** The parsed lockfile, and the texts it was parsed from. */
  lock?: { text: string; packageText: string | undefined; value: PackageLock | undefined };
}

/**
 * Runs tsc for any number of projects, one request at a time, keeping each
 * project's compiler state between requests.
 */
export class TscService {
  private projects = new Map<string, Project>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private env: TscEnvironment) {}

  /** Returns undefined when the project isn't in memory and the request isn't `full`. */
  run(request: TscRequest): Promise<TscResult | undefined> {
    const result = this.queue.then(() => this.handle(request));
    this.queue = result.catch(() => {});
    return result;
  }

  private async handle(request: TscRequest): Promise<TscResult | undefined> {
    const { projectRoot: root, cwd, args, changed } = request;

    let project = this.projects.get(root);
    if (!project) {
      if (!request.full) return undefined;
      project = { files: new Map() };
    }
    this.projects.delete(root);
    this.projects.set(root, project);
    while (this.projects.size > MAX_PROJECTS) this.projects.delete(this.projects.keys().next().value!);

    const removed = request.full ? [...project.files.keys()].filter((path) => !(path in changed)) : request.removed;
    for (const path of removed) project.files.delete(path);
    for (const [path, text] of Object.entries(changed)) project.files.set(path, text);

    const notes: string[] = [];
    const packageText = project.files.get(`${root}/package.json`);
    const rootPackage = parseJson<PackageJson>(packageText) ?? {};
    const lockText = LOCKFILES.map((file) => project.files.get(`${root}/${file}`) ?? '').join('\0');
    if (project.lock?.text !== lockText || project.lock.packageText !== packageText) {
      const found = await readLockfile((file) => project.files.get(`${root}/${file}`), rootPackage);
      project.lock = { text: lockText, packageText, value: found?.lock };
    }
    const lock = project.lock.value;
    const declaredTs = rootPackage.devDependencies?.typescript ?? rootPackage.dependencies?.typescript;
    const compilerSource = await chooseCompiler(lock, declaredTs, notes);
    const compiler = await loadCompiler(compilerSource, this.env);

    // Dependencies or the compiler changed: start over, keeping what carries across.
    const key = [compilerSource.resolved, lockText, packageText].join('\0');
    if (project.session?.key === key) {
      project.session.update(changed, removed);
    } else {
      project.session = await Session.create({
        root, key, compiler, lock, rootPackage, files: project.files, env: this.env, previous: project.session,
      });
    }

    try {
      const result = await project.session.run(cwd, args, notes);
      return { ...result, stderr: notes.join('\n') };
    } catch (error) {
      // The session may be half updated; rebuild it next time.
      project.session = undefined;
      throw error;
    }
  }
}
