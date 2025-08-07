import path from 'path-browserify';

import type { Loader, Plugin } from 'esbuild-wasm';
import type { JSRuntimeFS } from '@/lib/JSRuntime';

export function lightningFsPlugin(fs: JSRuntimeFS, cwd: string): Plugin {
  return {
    name: 'lightning-fs',
    setup(build) {
      build.onResolve({ filter: /.*/ }, async (args) => {
        let resolved: string;

        if (args.path.startsWith('@/')) {
          // Handle alias paths
          resolved = path.join(cwd, args.path.slice(2));
        } else if (args.path.startsWith('/')) {
          // Handle absolute paths
          resolved = args.path;
        } else if (args.importer) {
          // Handle relative imports - use the directory of the importing file
          const importerDir = path.dirname(args.importer);
          resolved = path.join(importerDir, args.path);
        } else {
          // Initial entry point or fallback to resolveDir
          resolved = path.join(cwd, args.resolveDir || '', args.path);
        }

        try {
          resolved = await tryFileVariants(fs, resolved);
        } catch {
          return; // Let other plugins handle this
        }

        return {
          path: resolved,
          namespace: 'lightning-fs',
        };
      });

      build.onLoad({ filter: /.*/, namespace: 'lightning-fs' }, async (args) => {
        const ext = path.extname(args.path).slice(1);

        if (!['ts', 'tsx', 'js', 'jsx', 'css'].includes(ext)) {
          return;
        }

        return {
          contents: await fs.readFile(args.path, 'utf8'),
          loader: ext as Loader,
          // Set resolveDir for subsequent imports from this file
          resolveDir: path.dirname(args.path),
        };
      });
    },
  };
}

async function tryFileVariants(fs: JSRuntimeFS, basePath: string): Promise<string> {
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.css'];

  try {
    const stat = await fs.stat(basePath);
    // If it's a file, return it directly
    if (stat.isFile()) {
      return basePath;
    }
    // If it's a directory, continue to check for index files
  } catch {
    // File doesn't exist, try with extensions
  }

  // Try direct file with extensions
  for (const ext of extensions) {
    const full = basePath + ext;
    try {
      const stat = await fs.stat(full);
      if (stat.isFile()) {
        return full;
      }
    } catch {
      // Ignore
    }
  }

  // Try directory index files
  for (const ext of extensions) {
    const indexFile = path.join(basePath, 'index' + ext);
    try {
      const stat = await fs.stat(indexFile);
      if (stat.isFile()) {
        return indexFile;
      }
    } catch {
      // Ignore
    }
  }

  throw new Error(`File not found: ${basePath}`);
}