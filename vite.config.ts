import { execSync } from "node:child_process";
import path from "node:path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

function getVersion(): string {
  try {
    const gitCommit = execSync('git rev-parse --short HEAD').toString().trim();
    const commitDate = execSync('git log -1 --format=%cd --date=format:%Y.%m.%d').toString().trim();
    return `${commitDate}+${gitCommit}`;
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
  ],
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // get the path after "node_modules/"
            const parts = id.toString().split('node_modules/')[1].split('/');

            // handle scoped packages (@scope/name)
            const pkgName = parts[0].startsWith('@')
              ? `${parts[0]}/${parts[1]}`
              : parts[0];

            return `npm/${pkgName.replace('@', '')}`;
          }
          if (id.includes('/src/')) {
            return 'app';
          }
        },
      },
    },
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