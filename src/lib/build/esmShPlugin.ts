import type { Loader, Plugin } from 'esbuild-wasm';

export function esmShPlugin(dependencies: Record<string, string>): Plugin {
  return {
    name: 'esm-sh',
    setup(build) {
      // Handle bare imports like "react"
      build.onResolve({ filter: /^[^./].*/ }, async (args) => {
        const jsrPrefix = "npm:@jsr/";

        const packageName = args.path.startsWith('@')
          ? args.path.split('/').slice(0, 2).join('/')
          : args.path.split('/')[0];

        const version = dependencies[packageName];
        const packagePath = args.path.slice(packageName.length);

        if (version.startsWith(jsrPrefix)) {
          const specifier = "@" + version.slice(jsrPrefix.length).replace('__', '/');

          return {
            path: `https://esm.sh/jsr/${specifier}?external=react,react-dom`,
            namespace: 'http',
          };
        }

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
        let fullURL: URL;
        
        if (args.path.startsWith('http://') || args.path.startsWith('https://')) {
          // Already a full URL
          fullURL = new URL(args.path);
        } else if (args.path.startsWith('/')) {
          // Absolute path - resolve from origin
          const baseURL = new URL(args.importer);
          fullURL = new URL(args.path, baseURL.origin);
        } else {
          // Relative path (including ./ and ../)
          const baseURL = new URL(args.importer);
          
          // For esm.sh package URLs, we need to ensure the package path ends with '/'
          // to treat it as a directory rather than a file
          let pathname = baseURL.pathname;
          
          // Decode the pathname to check for version patterns
          const decodedPathname = decodeURIComponent(pathname);
          
          // Check if this looks like a package URL and doesn't already end with '/'
          if (!pathname.endsWith('/')) {
            const lastSegment = decodedPathname.substring(decodedPathname.lastIndexOf('/') + 1);
            
            // If the last segment contains @ (version), it's likely a package reference
            // Common patterns: package@1.0.0, package@^1.0.0, @scope/package@1.0.0
            if (lastSegment.includes('@')) {
              // Check if there's a file extension after the version (like .js, .css)
              const versionPart = lastSegment.substring(lastSegment.lastIndexOf('@'));
              // Look for file extensions (.js, .css, etc) but not version dots (1.0.0)
              const hasFileExtension = /\.[a-zA-Z]+$/.test(versionPart);
              
              if (!hasFileExtension) {
                pathname += '/';
              }
            }
          }
          
          // Create new URL with modified pathname
          const baseURLWithSlash = new URL(baseURL);
          baseURLWithSlash.pathname = pathname;
          
          // Now resolve the relative path
          fullURL = new URL(args.path, baseURLWithSlash);
        }

        // Preserve/add external params
        fullURL.searchParams.set('external', 'react,react-dom');

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

        let loader: Loader | undefined;
        const contentType = res.headers.get('Content-Type')?.split(';')[0];

        if (contentType) {
          if (contentType === 'application/javascript') {
            loader = 'js';
          } else if (contentType === 'text/css') {
            loader = 'css';
          } else {
            loader = 'text';
          }
        }

        const contents = await res.text();

        return {
          contents,
          loader,
        };
      });
    },
  };
}
