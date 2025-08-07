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
  const packageJson = await fs.readFile(`/projects/${projectId}/package.json`, 'utf8');

  // Parse index.html to find the main script entry point
  const entryPoints = parseEntryPoints(indexHtml);
  if (!entryPoints.length) {
    throw new Error('No entry point script found in index.html');
  }

  const results = await esbuild.build({
    entryPoints,
    bundle: true,
    write: false,
    format: 'esm',
    target: 'esnext',
    outdir: 'dist',
    jsx: 'automatic',
    plugins: [
      lightningFsPlugin(fs, `/projects/${projectId}/src`),
      esmShPlugin(JSON.parse(packageJson).dependencies || {}),
    ],
  });

  const dist: Record<string, Uint8Array> = {};

  // Process output files
  const jsFiles: string[] = [];
  const cssFiles: string[] = [];

  for (const file of results.outputFiles) {
    const relativePath = file.path.replace(/^\/dist\//, '');
    dist[relativePath] = file.contents;

    // Track JS and CSS files for HTML injection
    if (relativePath.endsWith('.js')) {
      jsFiles.push(relativePath);
    } else if (relativePath.endsWith('.css')) {
      cssFiles.push(relativePath);
    }
  }

  // Update index.html with proper script and link tags
  const updatedHtml = updateIndexHtml(indexHtml, jsFiles, cssFiles);
  dist['index.html'] = new TextEncoder().encode(updatedHtml);

  return dist;
}

function parseEntryPoints(html: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Look for script tags with type="module" and src attribute
  const scripts = doc.getElementsByTagName('script');

  return Array.from(scripts)
    .filter((script) => new URL(script.src).origin === location.origin) // Only include same-origin scripts
    .map((script) => new URL(script.src).pathname.replace(/^\/src\//, ''));
}

function updateIndexHtml(originalHtml: string, jsFiles: string[], cssFiles: string[]): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(originalHtml, 'text/html');

  // Remove existing script tags that reference our built files
  for (const elem of doc.getElementsByTagName('script')) {
    if (new URL(elem.src).origin === location.origin) {
      elem.remove();
    }
  }

  // Remove existing link tags that reference our built CSS files
  for (const elem of doc.getElementsByTagName('link')) {
    if (elem.rel === 'stylesheet' && new URL(elem.href).origin === location.origin) {
      elem.remove();
    }
  }

  // Add CSS files to the head
  const head = doc.head;
  cssFiles.forEach((file) => {
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = `/${file}`;
    head.appendChild(link);
  });

  // Add JS files before the closing body tag
  const body = doc.body;
  jsFiles.forEach((file) => {
    const script = doc.createElement('script');
    script.type = 'module';
    script.src = `/${file}`;
    body.appendChild(script);
  });

  const tailwindScript = doc.createElement('script');
  tailwindScript.src = 'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4';
  head.appendChild(tailwindScript);

  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}