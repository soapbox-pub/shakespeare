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
          resolved = path.join(cwd, args.path.slice(2));
        } else if (args.path.startsWith('/')) {
          resolved = args.path;
        } else {
          resolved = path.join(cwd, args.resolveDir, args.path);
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
        };
      });
    },
  };
}

async function tryFileVariants(fs: JSRuntimeFS, basePath: string): Promise<string> {
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.css'];

  try {
    await fs.stat(basePath);
    return basePath;
  } catch {
    // Ignore
  }

  // Try direct file with extensions
  for (const ext of extensions) {
    const full = basePath + ext;
    try {
      await fs.stat(full);
      return full;
    } catch {
      // Ignore
    }
  }

  // Try directory index files
  for (const ext of extensions) {
    const indexFile = path.join(basePath, 'index' + ext);
    try {
      await fs.stat(indexFile);
      return indexFile;
    } catch {
      // Ignore
    }
  }

  throw new Error('File not found');
}
