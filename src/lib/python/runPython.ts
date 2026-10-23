/** Pyodide release the worker loads; its CPython version is `PYTHON_VERSION`. */
export const PYODIDE_VERSION = '314.0.7';
export const PYTHON_VERSION = '3.14.2';
export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

export type PythonMode =
  /** `python3 -c code` */
  | { kind: 'code'; code: string; filename: string }
  /** `python3 script.py` */
  | { kind: 'file'; path: string }
  /** `python3 -m module` */
  | { kind: 'module'; module: string }
  /** `python3 -m pip install ...` */
  | { kind: 'pip'; args: string[] };

export interface PythonRequest {
  /** Absolute working directory of the command. */
  cwd: string;
  mode: PythonMode;
  /** `sys.argv` for the script. */
  argv: string[];
  /** Standard input; EOF when undefined. */
  stdin?: string;
  /** Directories mirrored into the interpreter's filesystem and written back afterwards. */
  roots: string[];
  /** Every directory under the roots, so empty ones exist and deleted ones go away. */
  dirs: string[];
  /** Files added or changed since the last request, keyed by absolute path. */
  changed: Record<string, Uint8Array>;
  /** Files deleted since the last request. */
  removed: string[];
  /** `changed` holds every file under the roots rather than changes. */
  full: boolean;
  /** CORS proxy URL template that the script's HTTP requests go through. */
  corsProxy?: string;
}

export interface PythonResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  /** Files the script created or modified, keyed by absolute path. */
  writes: Record<string, Uint8Array>;
  /** Files the script deleted. */
  deletes: string[];
  /** Directories the script created. */
  mkdirs: string[];
  /** Directories the script deleted. */
  rmdirs: string[];
}

interface FSStat {
  mode: number;
  mtime: Date | number;
}

/** The subset of Emscripten's FS that the service uses. */
interface PyodideFS {
  readdir(path: string): string[];
  lstat(path: string): FSStat;
  isDir(mode: number): boolean;
  isFile(mode: number): boolean;
  mkdirTree(path: string): void;
  readFile(path: string): Uint8Array;
  writeFile(path: string, data: Uint8Array): void;
  unlink(path: string): void;
  rmdir(path: string): void;
  utime(path: string, atime: number, mtime: number): void;
}

interface PyProxy {
  (...args: unknown[]): unknown;
  destroy(): void;
}

/** The subset of the Pyodide API that the service uses. */
export interface PyodideAPI {
  FS: PyodideFS;
  runPython(code: string): unknown;
  runPythonAsync(code: string): Promise<unknown>;
  globals: { get(name: string): PyProxy };
  toPy(value: unknown): PyProxy;
  loadPackage(names: string | string[], options?: PackageLoadOptions): Promise<unknown>;
  loadPackagesFromImports(code: string, options?: PackageLoadOptions): Promise<unknown>;
  setStdin(options: { stdin?: () => string | undefined; isatty?: boolean }): void;
  setStdout(options: { write(buffer: Uint8Array): number; isatty?: boolean }): void;
  setStderr(options: { write(buffer: Uint8Array): number; isatty?: boolean }): void;
}

interface PackageLoadOptions {
  messageCallback?: (message: string) => void;
  errorCallback?: (message: string) => void;
}

/**
 * Runs one script with fresh `sys.argv`, working directory and `__main__`
 * namespace, and returns its exit status. Modules imported from outside the
 * interpreter's own `/lib` are forgotten afterwards, so edits to a project's
 * modules are picked up on the next run.
 */
const RUNNER = `
import builtins, importlib, os, runpy, sys, traceback

sys.dont_write_bytecode = True

def _shakespeare_streams():
    # Fresh streams each run: a script may close them (json.tool closes stdout).
    sys.stdin = open(0, 'r', encoding='utf-8', closefd=False)
    sys.stdout = open(1, 'w', encoding='utf-8', closefd=False)
    sys.stderr = open(2, 'w', encoding='utf-8', errors='backslashreplace', closefd=False)

def _shakespeare_flush():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.flush()
        except ValueError:
            pass

def _shakespeare_run(kind, target, filename, argv, cwd):
    _shakespeare_streams()
    saved_path = list(sys.path)
    saved_modules = set(sys.modules)
    sys.argv = list(argv)
    try:
        os.chdir(cwd)
        importlib.invalidate_caches()
        if kind == 'module':
            sys.path.insert(0, cwd)
            runpy.run_module(target, run_name='__main__', alter_sys=True)
        else:
            if kind == 'file':
                path = os.path.abspath(target)
                with open(path, 'rb') as f:
                    source = f.read()
                filename = target
                sys.path.insert(0, os.path.dirname(path))
            else:
                source = target
                sys.path.insert(0, '')
            namespace = {'__name__': '__main__', '__builtins__': builtins}
            if kind == 'file':
                namespace['__file__'] = filename
            exec(compile(source, filename, 'exec'), namespace)
        status = 0
    except SystemExit as e:
        if e.code is None:
            status = 0
        elif isinstance(e.code, int):
            status = e.code
        else:
            print(e.code, file=sys.stderr)
            status = 1
    except BaseException as e:
        traceback.print_exception(type(e), e, e.__traceback__.tb_next)
        status = 1
    finally:
        _shakespeare_flush()
        sys.path[:] = saved_path
        for name in set(sys.modules) - saved_modules:
            file = getattr(sys.modules[name], '__file__', None) or ''
            if not file.startswith('/lib/'):
                del sys.modules[name]
    return status

async def _shakespeare_pip(packages):
    import micropip
    _shakespeare_streams()
    try:
        await micropip.install(list(packages))
        print('Successfully installed ' + ' '.join(packages))
        return 0
    except Exception as e:
        print(f'ERROR: {e}', file=sys.stderr)
        return 1
    finally:
        _shakespeare_flush()
`;

/** `pip install` options that take a value, none of which micropip can honor. */
const PIP_VALUE_OPTIONS = new Set(['-r', '--requirement', '-c', '--constraint', '-i', '--index-url', '--extra-index-url']);

export class PythonService {
  private readonly load: () => Promise<PyodideAPI>;
  private pyodide?: Promise<PyodideAPI>;

  constructor(load: () => Promise<PyodideAPI>) {
    this.load = load;
  }

  private getPyodide(): Promise<PyodideAPI> {
    if (!this.pyodide) {
      this.pyodide = this.load().then(async (pyodide) => {
        pyodide.runPython(RUNNER);
        // urllib.request opens sockets, which a browser doesn't have; send it through XMLHttpRequest.
        await pyodide.loadPackage('pyodide-http', { messageCallback: () => {} });
        pyodide.runPython('import pyodide_http; pyodide_http.patch_urllib()');
        return pyodide;
      });
      this.pyodide.catch(() => {
        this.pyodide = undefined;
      });
    }
    return this.pyodide;
  }

  /**
   * Run a request. `onStart` is called once the interpreter is loaded and
   * the script's packages are installed, right before the script runs.
   */
  async run(request: PythonRequest, onStart?: () => void): Promise<PythonResult> {
    const pyodide = await this.getPyodide();
    const { FS } = pyodide;

    this.sync(FS, request);
    FS.mkdirTree(request.cwd);
    const before = snapshot(FS, request.roots);

    const stdout = new Output();
    const stderr = new Output();
    pyodide.setStdout({ write: (buffer) => stdout.write(buffer), isatty: false });
    pyodide.setStderr({ write: (buffer) => stderr.write(buffer), isatty: false });
    let stdin = request.stdin;
    pyodide.setStdin({
      stdin: () => {
        const text = stdin;
        stdin = undefined;
        return text || undefined;
      },
      isatty: false,
    });

    const packageOptions: PackageLoadOptions = {
      messageCallback: () => {},
      errorCallback: (message) => stderr.print(message),
    };

    let exitCode: number;
    const { mode } = request;
    if (mode.kind === 'pip') {
      onStart?.();
      exitCode = await this.pip(pyodide, mode.args, stderr);
    } else {
      const source = mode.kind === 'code'
        ? mode.code
        : mode.kind === 'module' ? `import ${mode.module}` : readSource(FS, request.cwd, mode.path);
      if (source !== undefined) await pyodide.loadPackagesFromImports(source, packageOptions).catch(() => {});
      onStart?.();

      const target = mode.kind === 'code' ? mode.code : mode.kind === 'module' ? mode.module : mode.path;
      const filename = mode.kind === 'code' ? mode.filename : '';
      const runner = pyodide.globals.get('_shakespeare_run');
      const argv = pyodide.toPy(request.argv);
      try {
        exitCode = Number(runner(mode.kind, target, filename, argv, request.cwd));
      } finally {
        argv.destroy();
        runner.destroy();
      }
    }

    return { stdout: stdout.text(), stderr: stderr.text(), exitCode, ...diff(FS, request.roots, before) };
  }

  /** Mirror the roots' files into the interpreter's filesystem. */
  private sync(FS: PyodideFS, request: PythonRequest): void {
    const dirs = new Set(request.dirs);
    for (const root of request.roots) {
      FS.mkdirTree(root);
      // Remove what no longer exists outside: everything, on a full sync.
      walk(FS, root, (path, stat) => {
        if (FS.isDir(stat.mode)) {
          if (dirs.has(path)) return true;
          removeTree(FS, path);
          return false;
        }
        if (request.full) FS.unlink(path);
        return false;
      });
    }
    for (const dir of request.dirs) FS.mkdirTree(dir);
    for (const path of request.removed) {
      try {
        FS.unlink(path);
      } catch {
        // Already gone.
      }
    }
    for (const [path, data] of Object.entries(request.changed)) {
      FS.mkdirTree(path.slice(0, path.lastIndexOf('/')) || '/');
      FS.writeFile(path, data);
      // A zero mtime means "as synced": anything the script writes gets a real one.
      FS.utime(path, 0, 0);
    }
  }

  private async pip(pyodide: PyodideAPI, args: string[], stderr: Output): Promise<number> {
    const [command, ...rest] = args;
    if (command !== 'install') {
      stderr.print(`pip: only \`pip install\` is supported here`);
      return 1;
    }
    const packages: string[] = [];
    for (let i = 0; i < rest.length; i++) {
      if (PIP_VALUE_OPTIONS.has(rest[i])) {
        stderr.print(`pip: ${rest[i]} is not supported here`);
        return 1;
      }
      if (!rest[i].startsWith('-')) packages.push(rest[i]);
    }
    if (packages.length === 0) {
      stderr.print('ERROR: You must give at least one requirement to install');
      return 1;
    }

    await pyodide.loadPackage('micropip', { messageCallback: () => {} });
    const pip = pyodide.globals.get('_shakespeare_pip');
    const list = pyodide.toPy(packages);
    try {
      return Number(await (pip(list) as Promise<unknown>));
    } finally {
      list.destroy();
      pip.destroy();
    }
  }
}

class Output {
  private readonly decoder = new TextDecoder();
  private buffer = '';

  write(data: Uint8Array): number {
    this.buffer += this.decoder.decode(data, { stream: true });
    return data.length;
  }

  print(line: string): void {
    this.buffer += `${line}\n`;
  }

  text(): string {
    return this.buffer + this.decoder.decode();
  }
}

function readSource(FS: PyodideFS, cwd: string, path: string): string | undefined {
  try {
    return new TextDecoder().decode(FS.readFile(path.startsWith('/') ? path : `${cwd}/${path}`));
  } catch {
    return undefined;
  }
}

/** Visit everything under `dir`. Return false from `visit` to skip a directory's contents. */
function walk(FS: PyodideFS, dir: string, visit: (path: string, stat: FSStat) => boolean): void {
  let names: string[];
  try {
    names = FS.readdir(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (name === '.' || name === '..') continue;
    const path = dir === '/' ? `/${name}` : `${dir}/${name}`;
    const stat = FS.lstat(path);
    if (visit(path, stat) && FS.isDir(stat.mode)) walk(FS, path, visit);
  }
}

function removeTree(FS: PyodideFS, dir: string): void {
  walk(FS, dir, (path, stat) => {
    if (FS.isDir(stat.mode)) removeTree(FS, path);
    else FS.unlink(path);
    return false;
  });
  FS.rmdir(dir);
}

interface Snapshot {
  files: Map<string, number>;
  dirs: Set<string>;
}

function snapshot(FS: PyodideFS, roots: string[]): Snapshot {
  const files = new Map<string, number>();
  const dirs = new Set<string>();
  for (const root of roots) {
    walk(FS, root, (path, stat) => {
      if (FS.isDir(stat.mode)) dirs.add(path);
      else if (FS.isFile(stat.mode)) files.set(path, Number(stat.mtime));
      return true;
    });
  }
  return { files, dirs };
}

function diff(FS: PyodideFS, roots: string[], before: Snapshot): Pick<PythonResult, 'writes' | 'deletes' | 'mkdirs' | 'rmdirs'> {
  const after = snapshot(FS, roots);
  const writes: Record<string, Uint8Array> = {};
  for (const [path, mtime] of after.files) {
    if (before.files.get(path) !== mtime) {
      writes[path] = FS.readFile(path);
      FS.utime(path, 0, 0);
    }
  }
  return {
    writes,
    deletes: [...before.files.keys()].filter((path) => !after.files.has(path)),
    mkdirs: [...after.dirs].filter((path) => !before.dirs.has(path)),
    rmdirs: [...before.dirs].filter((path) => !after.dirs.has(path)),
  };
}
