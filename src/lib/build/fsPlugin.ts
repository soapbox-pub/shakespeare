import { join, dirname, extname } from "path-browserify";

import type { Loader, Plugin } from "esbuild-wasm";
import type { JSRuntimeFS } from '@/lib/JSRuntime';

export function fsPlugin(fs: JSRuntimeFS, cwd: string): Plugin {
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

        let resolved: string;
        if (args.path.startsWith("/")) {
          resolved = args.path;
        } else if (args.path.startsWith("@/")) {
          resolved = join(cwd, args.path.slice(2));
        } else if (args.kind === "entry-point") {
          resolved = join(cwd, args.path);
        } else if (args.importer) {
          resolved = join(dirname(args.importer), args.path);
        } else {
          return;
        }

        // Security: prevent accessing files outside the project directory
        const projectDir = join(cwd, "..");
        if (resolved.startsWith("/") && !resolved.startsWith(projectDir)) {
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