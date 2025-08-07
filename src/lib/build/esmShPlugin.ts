import type { Plugin } from 'esbuild-wasm';

export function esmShPlugin(): Plugin {
  return {
    name: 'esm-sh',
    setup(build) {
      // Handle bare imports like "react"
      build.onResolve({ filter: /^[^./].*/ }, (args) => ({
        path: `https://esm.sh/${args.path}`,
        namespace: 'http',
      }));

      // Handle relative or absolute imports inside esm.sh modules
      build.onResolve({ filter: /.*/, namespace: 'http' }, (args) => {
        const baseURL = new URL(args.importer); // e.g., https://esm.sh/react-dom/client
        const fullURL = new URL(args.path, baseURL).toString(); // resolve "/x" → full URL
        return {
          path: fullURL,
          namespace: 'http',
        };
      });

      // Load HTTP modules
      build.onLoad({ filter: /.*/, namespace: 'http' }, async (args) => {
        const res = await fetch(args.path);

        if (!res.ok) {
          throw new Error(`Failed to fetch ${args.path}`);
        }

        const contents = await res.text();

        return {
          contents,
          loader: 'js',
        };
      });
    },
  };
}
