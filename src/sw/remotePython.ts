/**
 * `@/lib/python` in the service worker build (see `swPageModules` in vite.config.ts). Pyodide runs
 * in a Web Worker, which a service worker can't start, so a page runs it.
 */
import type { JSRuntimeFS } from '@/lib/JSRuntime';
import type { PythonOptions } from '@/lib/python/index';
import type { PythonResult } from '@/lib/python/runPython';

import { requestPage } from './pageBridge';

export type { PythonOptions };
export { PYTHON_VERSION } from '@/lib/python/runPython';

export async function python(_fs: JSRuntimeFS, options: PythonOptions): Promise<Pick<PythonResult, 'stdout' | 'stderr' | 'exitCode'>> {
  return await requestPage({ kind: 'python', options }) as Pick<PythonResult, 'stdout' | 'stderr' | 'exitCode'>;
}
