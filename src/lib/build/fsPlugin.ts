import { join, dirname, extname } from "path-browserify";

import type { Loader, Plugin } from "esbuild-wasm";
import type { JSRuntimeFS } from '@/lib/JSRuntime';

interface TsConfig {
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
}

interface FsPluginOptions {
  fs: JSRuntimeFS;
  cwd: string;
  tsconfig?: TsConfig;
}

export function fsPlugin(options: FsPluginOptions): Plugin {
  const { fs, cwd, tsconfig } = options;
  return {
    name: "fs",

    setup(build) {
      build.onResolve({ filter: /^data:/ }, (args) => {
        return {
          path: args.path,
          external: true,
        };
      });

      build.onResolve({ filter: /.*/ }, async (args) => {
        // Skip resolving paths from external URLs
        if (/^https?:\/\//.test(args.importer)) {
          return;
        }

        let resolved: string | undefined;

        // 1. Absolute paths from CSS files should be treated as external (public assets)
        if (args.path.startsWith("/")) {
          // Check if the importer is a CSS file
          const importerExt = args.importer ? extname(args.importer).slice(1) : '';
          if (importerExt === 'css') {
            // CSS imports of absolute paths are public assets (fonts, images, etc.)
            return {
              path: args.path,
              external: true,
            };
          }
          resolved = args.path;
        }
        // 2. Built-in @/ alias (always points to src/)
        else if (args.path.startsWith("@/")) {
          resolved = join(cwd, "src", args.path.slice(2));
        }
        // 3. Relative paths
        else if (args.importer && (args.path.startsWith("./") || args.path.startsWith("../"))) {
          resolved = join(dirname(args.importer), args.path);
        }
        // 4. Try tsconfig paths
        else if (tsconfig?.compilerOptions?.paths) {
          const paths = tsconfig.compilerOptions.paths;
          const baseUrl = tsconfig.compilerOptions.baseUrl || ".";

          // Try to match against tsconfig paths
          for (const [pattern, mappings] of Object.entries(paths)) {
            // Handle exact matches
            if (pattern === args.path) {
              const mapping = mappings[0];
              if (mapping) {
                resolved = join(cwd, baseUrl, mapping);
                break;
              }
            }

            // Handle wildcard patterns (e.g., "$lib/*": ["src/lib/*"])
            if (pattern.endsWith('/*')) {
              const prefix = pattern.slice(0, -2);
              if (args.path.startsWith(prefix + '/') || args.path === prefix) {
                const suffix = args.path.slice(prefix.length);
                const mapping = mappings[0];
                if (mapping) {
                  // Replace the * in the mapping with the suffix
                  const resolvedMapping = mapping.replace('*', suffix.slice(1) || '');
                  resolved = join(cwd, baseUrl, resolvedMapping);
                  break;
                }
              }
            }
          }
        }

        // 5. Try baseUrl as fallback
        if (!resolved && args.importer && tsconfig?.compilerOptions?.baseUrl) {
          resolved = join(cwd, tsconfig.compilerOptions.baseUrl, args.path);
        }

        // If still not resolved, let other plugins handle it
        if (!resolved) {
          return;
        }

        // Security: prevent accessing files outside the project directory
        if (resolved.startsWith("/") && !resolved.startsWith(cwd)) {
          throw new Error(`Access to files outside the project directory is not allowed: ${resolved}`);
        }

        // Vite query parameters https://vite.dev/guide/assets
        const [cleaned, query] = resolved.split("?");

        try {
          resolved = await tryFileVariants(fs, cleaned);
        } catch {
          return; // Let other plugins handle this
        }

        return {
          path: resolved + (typeof query === "string" ? "?" + query : ""),
          namespace: "fs",
        };
      });

      build.onLoad(
        { filter: /.*/, namespace: "fs" },
        async (args) => {
          const [path, query] = args.path.split("?");
          const params = new URLSearchParams(query);

          // https://vite.dev/guide/assets.html#importing-asset-as-string
          if (params.has("raw")) {
            return {
              contents: await fs.readFile(path, "utf8"),
              loader: "text",
            };
          }

          const ext = extname(path).slice(1);

          // Handle static assets
          if (!["ts", "tsx", "js", "jsx", "mjs", "cjs", "css", "json"].includes(ext)) {
            return {
              contents: await fs.readFile(path),
              loader: "file",
            };
          }

          return {
            contents: await fs.readFile(path, "utf8"),
            loader: ext as Loader,
          };
        },
      );
    },
  };
}

async function tryFileVariants(
  fs: JSRuntimeFS,
  basePath: string,
): Promise<string> {
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".css"];
  const stat = await statSafe(fs, basePath);

  // If it's a file, check if it exists
  if (stat.isFile()) {
    return basePath;
  }

  // If it's a directory, try index files
  if (stat.isDirectory()) {
    for (const ext of extensions) {
      const indexFile = join(basePath, "index" + ext);
      const indexStat = await statSafe(fs, indexFile);
      if (indexStat.isFile()) {
        return indexFile;
      }
    }
  }

  // Try direct file with extensions
  for (const ext of extensions) {
    const full = basePath + ext;
    const fullStat = await statSafe(fs, full);
    if (fullStat.isFile()) {
      return full;
    }
  }

  // If no file found, throw an error
  throw new Error("File not found");
}

async function statSafe(fs: JSRuntimeFS, filePath: string): Promise<{ isFile(): boolean; isDirectory(): boolean }> {
  try {
    return await fs.stat(filePath);
  } catch {
    return {
      isFile: () => false,
      isDirectory: () => false,
    };
  }
}