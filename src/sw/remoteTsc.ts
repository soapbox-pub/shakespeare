/**
 * `@/lib/tsc` in the service worker build (see `swPageModules` in vite.config.ts). The compiler runs
 * in a Web Worker, which a service worker can't start, so a page runs it.
 */
import type { JSRuntimeFS } from '@/lib/JSRuntime';
import type { TscOptions } from '@/lib/tsc/index';
import type { TscResult } from '@/lib/tsc/runTsc';

import { requestPage } from './pageBridge';

export type { TscOptions };

export async function tsc(_fs: JSRuntimeFS, options: TscOptions): Promise<Omit<TscResult, 'writes'>> {
  return await requestPage({ kind: 'tsc', options }) as Omit<TscResult, 'writes'>;
}

/** Pages warm up their own compiler. */
export async function warmTsc(_fs: JSRuntimeFS, _projectRoot: string): Promise<void> {}
