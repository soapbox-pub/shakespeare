import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import path from "node:path";

import react from "@vitejs/plugin-react-swc";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
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
 * Drop source maps for chunks that are pure Shiki grammar/theme data.
 *
 * Shiki emits ~280 such chunks. Their maps are worthless for debugging, and each
 * one costs a `path` tag in the nsite manifest, which must stay under relays'
 * ~64 KB event limit. Removing them keeps maps for the code that matters.
 */
function dropDataChunkSourcemaps(): Plugin {
  const isData = (id: string) => /[\\/]@shikijs[\\/](langs|themes)[\\/]/.test(id);
  return {
    name: 'drop-data-chunk-sourcemaps',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk' || !chunk.moduleIds.length || !chunk.moduleIds.every(isData)) continue;
        delete bundle[`${chunk.fileName}.map`];
        chunk.map = null;
        chunk.code = chunk.code.replace(/\n\/\/# sourceMappingURL=\S+\s*$/, '\n');
      }
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
    dropDataChunkSourcemaps(),
    VitePWA({
      includeAssets: ['shakespeare.svg', 'shakespeare-192x192.png', 'shakespeare-512x512.png', 'sine.mp3', 'CHANGELOG.md'],
      manifest: false, // Use existing manifest.webmanifest from public folder
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm,mp3}'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // 15 MB (to accommodate esbuild.wasm at ~12 MB)
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false,
        type: 'module'
      }
    })
  ],
  build: {
    sourcemap: true,
  },
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
