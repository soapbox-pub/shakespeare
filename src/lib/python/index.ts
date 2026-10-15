import { dirname, join } from 'path-browserify';

import type { JSRuntimeFS } from '../JSRuntime';
import type { PythonMode, PythonRequest, PythonResult } from './runPython';

export { PYTHON_VERSION } from './runPython';

const SKIP_DIRS = new Set(['node_modules', '.git']);
/** How long a script may run, once the interpreter and its packages are loaded. */
const RUN_TIMEOUT_MS = 120_000;

type WorkerReply = { id: number; started?: true; result?: PythonResult; error?: string };

interface Pending {
  resolve: (result: PythonResult) => void;
  reject: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}

let worker: Worker | undefined;
let nextId = 0;
const pending = new Map<number, Pending>();
/** What the worker holds of each root: file path -> modification stamp. */
const synced = new Map<string, Map<string, string>>();
let queue: Promise<unknown> = Promise.resolve();

/** Stop the worker, failing whatever it was running. The next run starts a fresh interpreter. */
function stopWorker(error: Error): void {
  worker?.terminate();
  worker = undefined;
  synced.clear();
  for (const request of pending.values()) {
    clearTimeout(request.timer);
    request.reject(error);
  }
  pending.clear();
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const { id, started, result, error } = event.data;
      const request = pending.get(id);
      if (!request) return;
      if (started) {
        request.timer = setTimeout(
          () => stopWorker(new TimeoutError(`timed out after ${RUN_TIMEOUT_MS / 1000} seconds`)),
          RUN_TIMEOUT_MS,
        );
        return;
      }
      clearTimeout(request.timer);
      pending.delete(id);
      if (error !== undefined) request.reject(new Error(error));
      else request.resolve(result!);
    };
    worker.onerror = (event) => stopWorker(new Error(event.message || 'python worker crashed'));
  }
  return worker;
}

class TimeoutError extends Error {}

function post(request: PythonRequest): Promise<PythonResult> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, request });
  });
}

/** List a root's files with a stamp that changes whenever a file is written, and its directories. */
async function listFiles(fs: JSRuntimeFS, dir: string, stamps: Map<string, string>, dirs: string[]): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  dirs.push(dir);
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) await listFiles(fs, path, stamps, dirs);
    } else if (entry.isFile()) {
      const stat = await fs.stat(path);
      // Without an mtime, a unique stamp makes the file count as changed.
      stamps.set(path, stat.mtimeMs === undefined ? `?${nextId++}` : `${stat.mtimeMs}:${stat.size}`);
    }
  }
}

async function listRoots(fs: JSRuntimeFS, roots: string[]): Promise<{ stamps: Map<string, Map<string, string>>; dirs: string[] }> {
  const stamps = new Map<string, Map<string, string>>();
  const dirs: string[] = [];
  for (const root of roots) {
    const files = new Map<string, string>();
    await listFiles(fs, root, files, dirs);
    stamps.set(root, files);
  }
  return { stamps, dirs };
}

export interface PythonOptions {
  /** Directories the script can see and write to (the project and /tmp). */
  roots: string[];
  cwd: string;
  mode: PythonMode;
  argv: string[];
  stdin?: string;
}

/**
 * Run Python over the virtual filesystem.
 *
 * Runs CPython (Pyodide, loaded from a CDN on first use) in a Web Worker.
 * The roots are mirrored into the interpreter's filesystem, sending only what
 * changed since the last run, and whatever the script writes under them is
 * written back. Packages the script imports are installed automatically when
 * Pyodide provides them.
 */
export function python(fs: JSRuntimeFS, options: PythonOptions): Promise<Pick<PythonResult, 'stdout' | 'stderr' | 'exitCode'>> {
  const result = queue.then(() => runPython(fs, options));
  queue = result.catch(() => {});
  return result;
}

async function runPython(fs: JSRuntimeFS, options: PythonOptions): Promise<Pick<PythonResult, 'stdout' | 'stderr' | 'exitCode'>> {
  const { roots } = options;
  const { stamps, dirs } = await listRoots(fs, roots);

  const full = roots.some((root) => !synced.has(root));
  const changed: Record<string, Uint8Array> = {};
  const removed: string[] = [];
  for (const [root, files] of stamps) {
    const previous = full ? undefined : synced.get(root);
    for (const [path, stamp] of files) {
      if (previous?.get(path) !== stamp) changed[path] = await fs.readFile(path);
    }
    if (previous) removed.push(...[...previous.keys()].filter((path) => !files.has(path)));
  }
  for (const root of roots) synced.delete(root);

  let result: PythonResult;
  try {
    result = await post({ ...options, dirs, changed, removed, full });
  } catch (error) {
    if (error instanceof TimeoutError) return { stdout: '', stderr: `python3: ${error.message}\n`, exitCode: 124 };
    throw error;
  }

  const stderr = [result.stderr];
  try {
    for (const dir of result.mkdirs) await fs.mkdir(dir, { recursive: true });
    for (const [path, data] of Object.entries(result.writes)) {
      await fs.mkdir(dirname(path), { recursive: true });
      await fs.writeFile(path, data);
    }
    for (const path of result.deletes) await fs.unlink(path).catch(() => {});
    for (const dir of [...result.rmdirs].reverse()) await fs.rmdir(dir).catch(() => {});
    // The worker now holds exactly what the roots contain.
    const after = await listRoots(fs, roots);
    for (const [root, files] of after.stamps) synced.set(root, files);
  } catch (error) {
    stderr.push(`python3: writing files back failed: ${error instanceof Error ? error.message : String(error)}\n`);
  }

  return { stdout: result.stdout, stderr: stderr.join(''), exitCode: result.exitCode };
}
