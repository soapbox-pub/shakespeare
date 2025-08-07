import * as esbuild from 'esbuild-wasm';

import { esmShPlugin } from './esmShPlugin';
import { lightningFsPlugin } from './lightningFsPlugin';

import type { JSRuntimeFS } from '@/lib/JSRuntime';

await esbuild.initialize({
  worker: false,
  wasmURL: 'https://unpkg.com/esbuild-wasm/esbuild.wasm',
});

export async function buildProject(fs: JSRuntimeFS, projectId: string): Promise<Record<string, Uint8Array>> {
  const indexHtml = await fs.readFile(`/projects/${projectId}/index.html`, 'utf8');

  // TODO: parse indexHtml to find entryPoints
  // The file will have an absolute path like `/src/main.tsx` which must be converted to a relative path like `main.tsx`

  const results = await esbuild.build({
    entryPoints: ['main.tsx'],
    bundle: true,
    write: false,
    format: 'esm',
    target: 'esnext',
    outdir: 'dist',
    plugins: [
      lightningFsPlugin(fs, `/projects/${projectId}/src`),
      esmShPlugin(),
    ],
  });

  const dist: Record<string, Uint8Array> = {};

  for (const file of results.outputFiles) {
    const relativePath = file.path.replace(/^\/dist\//, '');
    dist[relativePath] = file.contents;
  }

  // FIXME: We need to ensure that dist files are imported inside the index.html. If a file was processed from an existing tag, its path might need to be updated, otherwise it might need to be imported (eg a css output file due to css import in js)
  dist['index.html'] = new TextEncoder().encode(indexHtml);

  return dist;
}