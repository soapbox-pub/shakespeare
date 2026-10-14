import { dirname, join } from 'path-browserify';

import type { JSRuntimeFS } from '../JSRuntime';
import type { TscRequest, TscResult } from './runTsc';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist']);
/** Files the compiler may read: sources, configs, and incremental build info. */
const READABLE = /\.([mc]?[jt]sx?|json|tsbuildinfo)$|^\.tsbuildinfo$/;

let worker: Worker | undefined;
let nextId = 0;
const pending = new Map<number, { resolve: (result: TscResult) => void; reject: (error: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./tsc.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ id: number; result?: TscResult; error?: string }>) => {
      const { id, result, error } = event.data;
      const request = pending.get(id);
      pending.delete(id);
      if (result) request?.resolve(result);
      else request?.reject(new Error(error));
    };
    worker.onerror = (event) => {
      for (const request of pending.values()) request.reject(new Error(event.message || 'tsc worker crashed'));
      pending.clear();
      worker = undefined;
    };
  }
  return worker;
}

async function snapshot(fs: JSRuntimeFS, dir: string, files: Record<string, string>): Promise<void> {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) await snapshot(fs, path, files);
    } else if (READABLE.test(entry.name)) {
      files[path] = await fs.readFile(path, 'utf8');
    }
  }
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
 * package-lock.json and cached in IndexedDB. Files the compiler writes
 * (emitted JavaScript, .tsbuildinfo) are written back to the project.
 */
export async function tsc(fs: JSRuntimeFS, { projectRoot, cwd, args }: TscOptions): Promise<Omit<TscResult, 'writes'>> {
  const files: Record<string, string> = {};
  await snapshot(fs, projectRoot, files);

  const request: TscRequest = { projectRoot, cwd, args, files };
  const id = nextId++;
  const result = await new Promise<TscResult>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, request });
  });

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
