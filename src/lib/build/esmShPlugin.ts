import type { Plugin } from 'esbuild-wasm';

export function esmShPlugin(dependencies: Record<string, string>): Plugin {
  return {
    name: 'esm-sh',
    setup(build) {
      // Handle bare imports like "react"
      build.onResolve({ filter: /^[^./].*/ }, async (args) => {
        const packageName = args.path.startsWith('@')
          ? args.path.split('/').slice(0, 2).join('/')
          : args.path.split('/')[0];

        const version = dependencies[packageName];
        const packagePath = args.path.slice(packageName.length);

        if (version) {
          const specifier = packagePath
            ? `${packageName}@${version}${packagePath}`
            : `${packageName}@${version}`;

            return {
            path: `https://esm.sh/${specifier}?external=react,react-dom`,
            namespace: 'http',
          };
        }
      });

      // Handle relative or absolute imports inside esm.sh modules
      build.onResolve({ filter: /.*/, namespace: 'http' }, (args) => {
        const baseURL = new URL(args.importer); // e.g., https://esm.sh/react-dom/client
        const fullURL = new URL(args.path, baseURL); // resolve "/x" → full URL
        fullURL.searchParams.set('external', 'react,react-dom'); // ensure react is external
        return {
          path: fullURL.toString(),
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
