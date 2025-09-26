import path from "path-browserify";

import type { Loader, Plugin } from "esbuild-wasm";
import type { JSRuntimeFS } from '@/lib/JSRuntime';

export function fsPlugin(fs: JSRuntimeFS, cwd: string): Plugin {
  return {
    name: "fs",

    setup(build) {
      build.onResolve({ filter: /.*/ }, async (args) => {
        let resolved: string;

        if (args.path.startsWith("@/")) {
          resolved = path.join(cwd, args.path.slice(2));
        } else if (args.kind === "entry-point") {
          resolved = path.join(cwd, args.path);
        } else if (args.importer) {
          resolved = path.join(path.dirname(args.importer), args.path);
        } else {
          return;
        }

        try {
          resolved = await tryFileVariants(fs, resolved);
        } catch {
          return; // Let other plugins handle this
        }

        return {
          path: resolved,
          namespace: "fs",
        };
      });

      build.onLoad(
        { filter: /.*/, namespace: "fs" },
        async (args) => {
          const ext = path.extname(args.path).slice(1);

          if (!["ts", "tsx", "js", "jsx", "css", "json"].includes(ext)) {
            return;
          }

          return {
            contents: await fs.readFile(args.path, "utf8"),
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
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".css", ".json"];
  const stat = await statSafe(fs, basePath);

  // If it's a file, check if it exists
  if (stat.isFile()) {
    return basePath;
  }

  // If it's a directory, try index files
  if (stat.isDirectory()) {
    for (const ext of extensions) {
      const indexFile = path.join(basePath, "index" + ext);
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