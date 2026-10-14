import { dirname, join } from 'path-browserify';

import type { JSRuntimeFS } from '../JSRuntime';
import type { TscRequest, TscResult } from './runTsc';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist']);
/** Files the compiler may read: sources, configs, and incremental build info. */
const READABLE = /\.([mc]?[jt]sx?|json|tsbuildinfo)$|^\.tsbuildinfo$/;

type WorkerReply = { id: number; result?: TscResult; resync?: true; error?: string };

let worker: Worker | undefined;
let nextId = 0;
const pending = new Map<number, { resolve: (reply: WorkerReply) => void; reject: (error: Error) => void }>();
/** What the worker holds of each project: file path -> modification stamp. */
const synced = new Map<string, Map<string, string>>();
let queue: Promise<unknown> = Promise.resolve();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./tsc.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const request = pending.get(event.data.id);
      pending.delete(event.data.id);
      if (event.data.error !== undefined) request?.reject(new Error(event.data.error));
      else request?.resolve(event.data);
    };
    worker.onerror = (event) => {
      for (const request of pending.values()) request.reject(new Error(event.message || 'tsc worker crashed'));
      pending.clear();
      synced.clear();
      worker = undefined;
    };
  }
  return worker;
}

function post(request: TscRequest): Promise<WorkerReply> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, request });
  });
}

/** List the project's files with a stamp that changes whenever a file is written. */
async function listFiles(fs: JSRuntimeFS, dir: string, stamps: Map<string, string>): Promise<void> {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) await listFiles(fs, path, stamps);
    } else if (READABLE.test(entry.name)) {
      const stat = await fs.stat(path);
      // Without an mtime, a unique stamp makes the file count as changed.
      stamps.set(path, stat.mtimeMs === undefined ? `?${nextId++}` : `${stat.mtimeMs}:${stat.size}`);
    }
  }
}

async function send(fs: JSRuntimeFS, options: TscOptions, full: boolean): Promise<WorkerReply> {
  const { projectRoot } = options;
  const previous = full ? undefined : synced.get(projectRoot);
  const stamps = new Map<string, string>();
  await listFiles(fs, projectRoot, stamps);

  const changed: Record<string, string> = {};
  for (const [path, stamp] of stamps) {
    if (previous?.get(path) !== stamp) changed[path] = await fs.readFile(path, 'utf8');
  }
  const removed = previous ? [...previous.keys()].filter((path) => !stamps.has(path)) : [];

  synced.delete(projectRoot);
  const reply = await post({ ...options, changed, removed, full: !previous });
  if (!reply.resync) synced.set(projectRoot, stamps);
  return reply;
}

export interface TscOptions {
  /** The project directory; the compiler sees only files under it. */
  projectRoot: string;
  cwd: string;
  args: string[];
}

/**
 * Run the TypeScript compiler CLI over a project in the virtual filesystem.
 *
 * Runs in a Web Worker with the project's own TypeScript version. Dependency
 * type declarations are downloaded from the npm registry according to
 * package-lock.json and cached in IndexedDB. The worker keeps each project's
 * last program, so a type check after an edit only rechecks what changed.
 * Files the compiler writes (emitted JavaScript, .tsbuildinfo) are written
 * back to the project.
 */
export function tsc(fs: JSRuntimeFS, options: TscOptions): Promise<Omit<TscResult, 'writes'>> {
  const result = queue.then(() => runTsc(fs, options));
  queue = result.catch(() => {});
  return result;
}

async function runTsc(fs: JSRuntimeFS, options: TscOptions): Promise<Omit<TscResult, 'writes'>> {
  const { projectRoot } = options;
  let reply = await send(fs, options, false);
  if (reply.resync) reply = await send(fs, options, true);
  const result = reply.result!;

  const stderr = [result.stderr];
  for (const [path, text] of Object.entries(result.writes)) {
    if (!path.startsWith(`${projectRoot}/`)) {
      stderr.push(`tsc: not writing ${path}: outside the project`);
      continue;
    }
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, text, 'utf8');
  }

  return { stdout: result.stdout, stderr: stderr.filter(Boolean).join('\n'), exitCode: result.exitCode };
}

/**
 * Type check a project in the background so that the first `tsc` the agent
 * runs is fast: by then, dependency types are downloaded and the program is
 * built. Does nothing for projects without a tsconfig.json.
 */
export async function warmTsc(fs: JSRuntimeFS, projectRoot: string): Promise<void> {
  if (typeof Worker === 'undefined') return;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;
  try {
    await fs.stat(`${projectRoot}/tsconfig.json`);
  } catch {
    return;
  }
  await tsc(fs, { projectRoot, cwd: projectRoot, args: ['--noEmit'] }).catch(() => {});
}
