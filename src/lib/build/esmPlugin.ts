import type { Loader, Plugin } from "esbuild-wasm";

interface PackageLock {
  packages: {
    [key: string]: {
      name?: string;
      version: string;
    } | undefined;
  };
}

export function esmPlugin(packageLock: PackageLock, target?: string): Plugin {
  /** Cache of URL redirects */
  const redirectedURLs = new Map<string, string>();

  /** Retrieve redirected URL from cache */
  const getRedirectedURL = async (url: string): Promise<string> => {
    const existing = redirectedURLs.get(url);
    if (existing) return existing;

    const response = await fetch(url, { method: "HEAD", redirect: "manual" });

    if (response.status === 301 || response.status === 302) {
      const location = response.headers.get("Location");
      if (location) {
        redirectedURLs.set(url, location);
        return location;
      }
    }

    redirectedURLs.set(url, url);
    return url;
  };

  return {
    name: "esm",

    setup(build) {
      // http(s) imports
      build.onResolve({ filter: /^https?:\/\// }, (args) => {
        return {
          path: args.path,
          namespace: "esm",
        };
      });

      // Handle bare imports like "react"
      build.onResolve({ filter: /^[^./].*/ }, (args) => {
        const packageName = args.path.startsWith("@")
          ? args.path.split("/").slice(0, 2).join("/")
          : args.path.split("/")[0];

        // Handle transitive dependency versions
        const keys: string[] = [];
        try {
          const importerPackage = extractPackageName(args.importer);
          keys.push(
            `node_modules/${importerPackage}/node_modules/${packageName}`,
          );
        } catch {
          // fallthrough
        }

        keys.push(`node_modules/${packageName}`);

        const packageInfo = keys
          .map((key) => packageLock.packages[key])
          .find((info) => info);

        const packagePath = args.path.slice(packageName.length);
        const version = packageInfo?.version;

        if (!version) return;

        const name = packageInfo.name ?? packageName;
        const specifier = `${name}@${version}${packagePath}`;

        const url = new URL(`https://esm.sh/*${specifier}`);

        if (target) {
          url.searchParams.set("target", target);
        }

        return {
          path: url.toString(),
          namespace: "esm",
        };
      });

      // Handle relative or absolute imports inside esm.sh modules
      build.onResolve({ filter: /.*/, namespace: "esm" }, async (args) => {
        let fullURL: URL;

        try {
          fullURL = new URL(args.path);
        } catch {
          try {
            // When resolving relative paths, it's important the baseURL is *after* any redirects.
            // For example, `https://esm.sh/@fontsource/inter@5.2.6` redirects to `https://esm.sh/@fontsource/inter@5.2.6/index.css`
            // and this changes the outcome of resolving paths like `./font.woff2` and `../font.woff2`
            const baseURL = args.path.startsWith("./")
              ? await getRedirectedURL(args.importer)
              : args.importer;

            fullURL = new URL(args.path, baseURL);
          } catch {
            return {
              errors: [{ text: `Could not resolve ${args.path}` }],
            };
          }
        }

        return {
          path: fullURL.toString(),
          namespace: "esm",
        };
      });

      // Load ESM modules
      build.onLoad({ filter: /.*/, namespace: "esm" }, async (args) => {
        const res = await fetch(args.path);

        if (res.redirected) {
          redirectedURLs.set(args.path, res.url);
        }

        if (!res.ok) {
          throw new Error(`Failed to fetch ${args.path}`);
        }

        let loader: Loader | undefined;
        const contentType = res.headers.get("Content-Type")?.split(";")[0];

        if (contentType) {
          if (contentType === "application/javascript") {
            loader = "js";
          } else if (contentType === "text/css") {
            loader = "css";
          } else {
            loader = "text";
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

/** Extract package name from esm.sh-style URL */
function extractPackageName(esmShURL: string): string {
  const full = new URL(esmShURL)
    .pathname
    .slice(1)
    .replace(/^\*/, "");

  const base = full.startsWith("@")
    ? full.split("/").slice(0, 2).join("/")
    : full.split("/")[0];

  return full.startsWith("@")
    ? base.split("@").splice(0, 2).join("@")
    : base.split("@")[0];
}
