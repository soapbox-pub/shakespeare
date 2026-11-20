import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import path from "node:path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import { VitePWA } from 'vite-plugin-pwa';

const require = createRequire(import.meta.url);
const pkg = require("./package.json") as { version: string };

/** Short commit SHA — prefer CI env var, fall back to git. */
function getCommitSha(): string {
  if (process.env.CI_COMMIT_SHORT_SHA) return process.env.CI_COMMIT_SHORT_SHA;
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

/** Git tag for the current commit — prefer CI env var, fall back to git. Empty string if untagged. */
function getCommitTag(): string {
  if (process.env.CI_COMMIT_TAG) return process.env.CI_COMMIT_TAG;
  try {
    return execSync("git describe --exact-match --tags HEAD 2>/dev/null", { encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

/**
 * In the service worker's build, modules that start Web Workers (which a service worker can't)
 * are swapped for ones that ask a page to do the work, and esbuild's wasm is the file the app's
 * build emitted (the service worker's build is a library build, which would inline its 12 MB).
 */
function swPageModules(): Plugin {
  const esbuildWasm = "\0esbuild-wasm-url";
  const replacements: Record<string, string> = {
    [path.resolve(__dirname, "src/lib/tsc/index.ts")]: path.resolve(__dirname, "src/sw/remoteTsc.ts"),
    [path.resolve(__dirname, "src/lib/python/index.ts")]: path.resolve(__dirname, "src/sw/remotePython.ts"),
  };
  return {
    name: "shakespeare-sw-page-modules",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (source === "esbuild-wasm/esbuild.wasm?url") return esbuildWasm;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (resolved && replacements[resolved.id] && importer !== replacements[resolved.id]) {
        return replacements[resolved.id];
      }
      return null;
    },
    load(id) {
      if (id !== esbuildWasm) return null;
      // The app's build has already written dist when the service worker is built.
      const name = readdirSync(path.resolve(__dirname, "dist/assets")).find((file) => /^esbuild-.*\.wasm$/.test(file));
      if (!name) throw new Error("esbuild's wasm isn't in dist/assets");
      return `export default ${JSON.stringify(`/assets/${name}`)};`;
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    'import.meta.env.VERSION': JSON.stringify(pkg.version),
    'import.meta.env.BUILD_DATE': JSON.stringify(new Date().toISOString()),
    'import.meta.env.COMMIT_SHA': JSON.stringify(getCommitSha()),
    'import.meta.env.COMMIT_TAG': JSON.stringify(getCommitTag()),
  },
  plugins: [
    react(),
    VitePWA({
      // A worker of our own: the precache, and the assistant where Din lets it run in the background
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['shakespeare.svg', 'shakespeare-192x192.png', 'shakespeare-512x512.png', 'sine.mp3', 'CHANGELOG.md'],
      manifest: false, // Use existing manifest.webmanifest from public folder
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm,mp3}'],
        // onnxruntime (~27 MB) is only for dictation, so it's fetched when first used.
        globIgnores: ['**/ort-wasm-*'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // 15 MB (to accommodate esbuild.wasm at ~12 MB)
        // Registered as a classic script
        rollupFormat: 'iife',
        buildPlugins: {
          vite: [swPageModules()],
        },
      },
      devOptions: {
        enabled: false,
        type: 'module'
      }
    })
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    onConsoleLog(log) {
      return !log.includes("React Router Future Flag Warning");
    },
    env: {
      DEBUG_PRINT_LIMIT: '0', // Suppress DOM output that exceeds AI context windows
    },
    css: true
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // just-bash's browser bundle imports node:zlib for gzip.
      "node:zlib": path.resolve(__dirname, "./src/lib/shell/zlib.ts"),
    },
  },
}));
