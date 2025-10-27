import { execSync } from "node:child_process";
import path from "node:path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";
import { VitePWA } from 'vite-plugin-pwa';

function getVersion(): string {
  try {
    const gitCommit = execSync('git rev-parse --short HEAD').toString().trim();
    const commitTimestamp = execSync('git log -1 --format=%ct').toString().trim();
    const commitDate = new Date(parseInt(commitTimestamp) * 1000);
    const utcDate = commitDate.toISOString().split('T')[0].replace(/-/g, '.');
    return `${utcDate}+${gitCommit}`;
  } catch {
    return new Date().toISOString().split('T')[0].replace(/-/g, '.');
  }
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    'import.meta.env.VERSION': JSON.stringify(getVersion()),
  },
  plugins: [
    react(),
    VitePWA({
      includeAssets: ['shakespeare.svg', 'shakespeare-192x192.png', 'shakespeare-512x512.png', 'sine.mp3'],
      manifest: false, // Use existing manifest.webmanifest from public folder
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm,mp3}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB
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
    },
  },
}));