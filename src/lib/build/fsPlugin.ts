import { join, dirname, extname } from "path-browserify";

import type { Loader, Plugin } from "esbuild-wasm";
import type { JSRuntimeFS } from '@/lib/JSRuntime';

interface TsConfig {
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
}

interface PackageJson {
  dependencies?: { [key: string]: string };
  devDependencies?: { [key: string]: string };
  peerDependencies?: { [key: string]: string };
}

interface FsPluginOptions {
  fs: JSRuntimeFS;
  cwd: string;
  tsconfig?: TsConfig;
  packageJson?: PackageJson;
}

export function fsPlugin(options: FsPluginOptions): Plugin {
  const { fs, cwd, tsconfig, packageJson } = options;
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
        // Skip resolving paths from external URLs (but not fs: namespace)
        if (/^https?:\/\//.test(args.importer)) {
          return;
        }

        let resolved: string | undefined;
        
        // Handle absolute paths
        if (args.path.startsWith("/")) {
          resolved = args.path;
        } 
        // Handle @/ alias
        else if (args.path.startsWith("@/")) {
          resolved = join(cwd, "src", args.path.slice(2));
        } 
        // Handle relative paths
        else if (args.importer && (args.path.startsWith("./") || args.path.startsWith("../"))) {
          // Remove fs: prefix from importer if present
          const importerPath = args.importer.replace(/^fs:/, '');
          resolved = join(dirname(importerPath), args.path);
        } 
        // Handle bare imports (e.g., "react", "@scope/package")
        else if (args.path.match(/^[^./]/)) {
          // Check if this is a file: dependency
          const packageName = args.path.startsWith("@")
            ? args.path.split("/").slice(0, 2).join("/")
            : args.path.split("/")[0];
          
          const allDeps = {
            ...packageJson?.dependencies,
            ...packageJson?.devDependencies,
            ...packageJson?.peerDependencies,
          };
          
          const depVersion = allDeps[packageName];
          
          if (depVersion && depVersion.startsWith("file:")) {
            // Extract the file path (e.g., "file:./path" -> "./path")
            const filePath = depVersion.slice(5); // Remove "file:" prefix
            const packagePath = join(cwd, filePath);
            
            // Get the subpath within the package (e.g., "package/subdir/file" -> "/subdir/file")
            const subpath = args.path.slice(packageName.length);
            
            resolved = join(packagePath, subpath);
          } else {
            return; // Let esmPlugin handle this
          }
        } 
        // Handle tsconfig baseUrl
        else if (args.importer && tsconfig?.compilerOptions?.baseUrl) {
          resolved = join(cwd, tsconfig.compilerOptions.baseUrl, args.path);
        } 
        // Nothing matched, let other plugins handle it
        else {
          return;
        }
        
        if (!resolved) {
          return;
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

  // If it's a directory, try package.json first, then index files
  if (stat.isDirectory()) {
    // Try to read package.json for entry point
    try {
      const packageJsonPath = join(basePath, "package.json");
      const packageJsonText = await fs.readFile(packageJsonPath, "utf8");
      const packageJson = JSON.parse(packageJsonText);
      
      // Check for various entry point fields
      const entryPoint = packageJson.exports?.['.']
        || packageJson.module 
        || packageJson.main 
        || 'index.js';
      
      // Resolve the entry point
      const entryPath = typeof entryPoint === 'string' 
        ? join(basePath, entryPoint)
        : join(basePath, 'index.js');
      
      const entryStat = await statSafe(fs, entryPath);
      if (entryStat.isFile()) {
        return entryPath;
      }
      
      // Try with different extensions if the entry point doesn't exist
      for (const ext of extensions) {
        const entryWithExt = entryPath.replace(/\.[^.]+$/, '') + ext;
        const entryExtStat = await statSafe(fs, entryWithExt);
        if (entryExtStat.isFile()) {
          return entryWithExt;
        }
      }
    } catch {
      // package.json doesn't exist or is invalid, fall through to index files
    }
    
    // Fall back to trying index files
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