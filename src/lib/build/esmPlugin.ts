import { extname } from "path-browserify";
import type { Loader, Plugin } from "esbuild-wasm";

interface PackageLock {
  packages: {
    [key: string]: {
      name?: string;
      version: string;
      /** Resolved dependencies for this package (as in package-lock v2 packages[...] entry) */
      dependencies?: { [key: string]: string };
      peerDependencies?: { [key: string]: string };
    } | undefined;
  };
}

interface PackageJson {
  dependencies?: { [key: string]: string };
  devDependencies?: { [key: string]: string };
  peerDependencies?: { [key: string]: string };
}

interface EsmPluginOptions {
  packageJson: PackageJson;
  packageLock?: PackageLock;
  target?: string;
  esmUrl: string;
}

export function esmPlugin(options: EsmPluginOptions): Plugin {
  const { packageJson, packageLock, target, esmUrl } = options;
  /** Cache of URL redirects */
  const redirectedURLs = new Map<string, string>();

  /** Map a module URL to its concrete lockfile path (breadcrumb) */
  const urlLockPath = new Map<string, string>();

  /** Build quick indexes from the lockfile */
  const packagesEntries = packageLock
    ? Object.entries(packageLock.packages || {}).filter(
      (e): e is [string, NonNullable<PackageLock["packages"][string]>] => Boolean(e[1])
    )
    : [];

  // Map of `${name}@${version}` -> array of lock paths where that exact install exists
  const nameVersionToPaths = new Map<string, string[]>();

  for (const [p, info] of packagesEntries) {
    const name = info.name;
    const version = info.version;
    if (!name || !version) continue;
    const key = `${name}@${version}`;
    const arr = nameVersionToPaths.get(key) ?? [];
    arr.push(p);
    nameVersionToPaths.set(key, arr);
  }

  /** Normalize an import name to the name used in the lock (handle @jsr/*) */
  const normalizeNameForLock = (name: string): string => {
    if (name.startsWith("@jsr/")) {
      // @jsr/scope__name -> @scope/name
      return `@${name.slice(5).replace("__", "/")}`;
    }
    return name;
  };

  /** Choose the shortest (most hoisted) lock path */
  const pickShortestPath = (paths: string[]): string | undefined => {
    if (!paths || paths.length === 0) return undefined;
    return paths
      .slice()
      .sort((a, b) => a.split("/").length - b.split("/").length)[0];
  };

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

  /** Try to get the importer lock path from url -> lp param or index */
  const getImporterLockPath = (importer: string): string | undefined => {
    try {
      const u = new URL(importer);
      const lp = u.searchParams.get("lp");
      if (lp) return decodeURIComponent(lp);
      const cached = urlLockPath.get(importer);
      if (cached) return cached;

      // Infer from package name@version in the esm.sh URL
      const { pkg, version } = extractPackageName(importer);
      if (!pkg || !version) return undefined;

      // Try exact name used by CDN first (often @jsr/*), then normalized
      const key1 = `${pkg}@${version}`;
      const key2 = `${normalizeNameForLock(pkg)}@${version}`;
      const paths = nameVersionToPaths.get(key1) || nameVersionToPaths.get(key2);
      return paths ? pickShortestPath(paths) : undefined;
    } catch {
      return undefined;
    }
  };

  /** Resolve a dependency name from a given lock path by walking ancestors */
  const resolveFrom = (lockPath: string | undefined, depName: string): string | undefined => {
    const dep = normalizeNameForLock(depName);

    const has = (p: string): boolean => Boolean(packageLock?.packages?.[p]);

    // Self-import: if the importer package name matches the requested dep, return the same lock path
    if (lockPath && packageLock) {
      const importerInfo = packageLock.packages?.[lockPath];
      const importerNameFromInfo = importerInfo?.name ? normalizeNameForLock(importerInfo.name) : undefined;
      const importerNameFromPath = lockPath.replace(/^.*\bnode_modules\//, "");
      const importerCanonical = importerNameFromInfo || importerNameFromPath;

      if (importerCanonical && importerCanonical === dep) {
        return lockPath;
      }
      // Also support case where dep requests @jsr alias and importer uses canonical (or vice versa)
      if (dep.startsWith("@")) {
        const [scope, name] = dep.slice(1).split("/");
        if (scope && name) {
          const jsrAlias = `@jsr/${scope}__${name}`;
          const importerCanonicalJsr = importerInfo?.name
            ? normalizeNameForLock(importerInfo.name)
            : normalizeNameForLock(importerNameFromPath);
          if (importerCanonicalJsr === normalizeNameForLock(jsrAlias)) {
            return lockPath;
          }
        }
      }
    }

    const findUp = (base: string | undefined, name: string): string | undefined => {
      if (!base) {
        const root = `node_modules/${name}`;
        return has(root) ? root : undefined;
      }

      // First, check for nested node_modules directly inside the importer's package
      const nested = `${base}/node_modules/${name}`;
      if (has(nested)) return nested;

      // Then walk up the tree looking for hoisted versions
      let current: string | undefined = base;
      while (current && current.length) {
        // Remove the last package from the path (handling scoped packages like @scope/name)
        const next = current.replace(/\/node_modules\/(@[^/]+\/)?[^/]+$/, "");
        if (next === current) break;
        current = next;
        const candidate = `${current}/node_modules/${name}`;
        if (has(candidate)) return candidate;
      }

      // Finally check root
      const root = `node_modules/${name}`;
      return has(root) ? root : undefined;
    };

    // Prefer alias that matches the importer's declared dependency (JSR vs canonical)
    let searchOrder: string[] = [dep];
    if (dep.startsWith("@")) {
      const m = dep.match(/^@([^/]+)\/([^/]+)$/);
      if (m) {
        const jsrAlias = `@jsr/${m[1]}__${m[2]}`;
        // Read importer deps from lockPath
        const importerDeps = lockPath && packageLock ? packageLock.packages?.[lockPath]?.dependencies : undefined;
        if (importerDeps && Object.prototype.hasOwnProperty.call(importerDeps, jsrAlias)) {
          searchOrder = [jsrAlias, dep];
        } else {
          searchOrder = [dep, jsrAlias];
        }
      }
    }

    for (const name of searchOrder) {
      const found = findUp(lockPath, name);
      if (found) return found;
    }

    return undefined;
  };

  /** Set lock path for a URL and also mirror for any cached redirected URL */
  const setUrlLockPath = (url: string, lockPath?: string) => {
    if (!lockPath) return;
    urlLockPath.set(url, lockPath);
    const redirected = redirectedURLs.get(url);
    if (redirected) {
      urlLockPath.set(redirected, lockPath);
    }
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

      // node built-in modules
      build.onResolve({ filter: /^node:/ }, (args) => {
        const moduleName = args.path.slice(5);

        switch (moduleName) {
          case "buffer":
          case "events":
            return {
              path: `${esmUrl}/${moduleName}?target=${target ?? "esnext"}`,
              namespace: "esm",
            };
          default:
            return {
              errors: [{ text: `Module not found: ${args.path}` }],
            };
        }
      });

      // Legacy (Internet Explorer) "behavior" syntax
      build.onResolve({ filter: /^#default#/, namespace: "esm" }, (args) => {
        return {
          path: args.path,
          external: true,
        };
      });

      // Handle bare imports like "react"
      build.onResolve({ filter: /^[^./].*/ }, (args) => {
        // HACK: https://github.com/esm-dev/esm.sh/issues/1217
        if (args.path === "yet-another-react-lightbox/styles.css") {
          args.path = "yet-another-react-lightbox/dist/styles.css";
        }

        const packageName = args.path.startsWith("@")
          ? args.path.split("/").slice(0, 2).join("/")
          : args.path.split("/")[0];

        // If the importer is CSS, ignore (no JS deps)
        try {
          const { pathname } = new URL(args.importer);
          if (/\.css$/.test(pathname)) {
            return; // CSS imports don't have external dependencies
          }
        } catch {
          // not a URL; continue
        }

        // Determine importer lock path (breadcrumb)
        const importerLockPath = getImporterLockPath(args.importer);

        // Resolve the dependency from the importer context up to root
        const childLockPath = resolveFrom(importerLockPath, packageName);

        // Determine CDN name and version
        const childInfo = childLockPath && packageLock ? packageLock.packages?.[childLockPath] : undefined;
        let version = childInfo?.version; // exact installed version from lock

        // If no version found in lock file, fall back to package.json
        if (!version) {
          version = packageJson.dependencies?.[packageName]
            ?? packageJson.devDependencies?.[packageName]
            ?? packageJson.peerDependencies?.[packageName];
        }

        // Decide CDN package name. Prefer explicit @jsr alias, then installed name, then canonical normalized name.
        const importerInfo = importerLockPath && packageLock ? packageLock.packages?.[importerLockPath] : undefined;
        const importerDeps = importerInfo?.dependencies ?? undefined;

        // Determine CDN package name
        let cdnName: string | undefined;

        // If the lock path is a JSR install, extract the @jsr/alias from the path
        if (childLockPath) {
          // Extract the deepest package segment under node_modules to avoid including parent paths
          // e.g. node_modules/@jsr/nostrify__nostrify/node_modules/@jsr/std__encoding
          //  -> take the last node_modules segment "@jsr/std__encoding"
          const lastNm = childLockPath.split("node_modules/").filter(Boolean).pop();
          if (lastNm && lastNm.startsWith("@jsr/")) {
            const segs = lastNm.split("/");
            // Ensure only the package folder is used (scope + name)
            if (segs.length >= 2) {
              cdnName = `${segs[0]}/${segs[1]}`;
            }
          }
        }

        // If not a JSR install in the lock, use the package name as-is or from childInfo
        if (!cdnName) {
          cdnName = childInfo?.name ?? packageName;
        }

        // If the importer declared a @jsr alias for this dependency, prefer that alias
        // This handles cases where the same package can be installed via JSR or npm
        const canonical = normalizeNameForLock(packageName);
        if (importerDeps && canonical.startsWith("@")) {
          const [scope, name] = canonical.slice(1).split("/");
          if (scope && name) {
            const jsrAlias = `@jsr/${scope}__${name}`;
            if (Object.prototype.hasOwnProperty.call(importerDeps, jsrAlias)) {
              cdnName = jsrAlias;
            }
          }
        }

        const packagePath = args.path.slice(packageName.length);
        const specifier = version
          ? `${cdnName}@${version}${packagePath}`
          : `${cdnName}${packagePath}`;

        const url = new URL(`${esmUrl}/*${specifier}`);
        if (target) url.searchParams.set("target", target);
        if (childLockPath) url.searchParams.set("lp", encodeURIComponent(childLockPath));

        const urlStr = url.toString();
        setUrlLockPath(urlStr, childLockPath);

        // HACK: https://github.com/esm-dev/esm.sh/issues/1218
        if (specifier === "@lightninglabs/lnc-web@0.3.4-alpha") {
          return {
            path: urlStr,
            external: true,
          };
        }

        return {
          path: urlStr,
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

        // Propagate lp breadcrumb from importer
        try {
          const importerUrl = new URL(args.importer);
          const lp = importerUrl.searchParams.get("lp") || urlLockPath.get(args.importer);
          if (lp && !fullURL.searchParams.get("lp")) {
            fullURL.searchParams.set("lp", lp);
            setUrlLockPath(fullURL.toString(), decodeURIComponent(lp));
          }
        } catch {
          // ignore
        }

        // Externalize static assets
        const ext = extname(fullURL.pathname).slice(1);
        if (ext && !["ts", "tsx", "js", "jsx", "mjs", "cjs", "css", "json"].includes(ext)) {
          return {
            path: fullURL.toString(),
            external: true,
          };
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
          // carry over lock path for redirected URL
          const lp = (() => {
            try {
              const u = new URL(args.path);
              return u.searchParams.get("lp");
            } catch {
              return undefined;
            }
          })();
          const existing = lp ? decodeURIComponent(lp) : urlLockPath.get(args.path);
          if (existing) setUrlLockPath(res.url, existing);
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

/** Extract package name from ESM CDN-style URL */
function extractPackageName(esmURL: string): { pkg?: string; version?: string } {
  const full = new URL(esmURL)
    .pathname
    .slice(1)
    .replace(/^\*/, "");

  const base = full.startsWith("@")
    ? full.split("/").slice(0, 2).join("/")
    : full.split("/")[0];

  const pkg = full.startsWith("@")
    ? base.split("@").splice(0, 2).join("@")
    : base.split("@")[0];

  let version: string | undefined;

  if (full.slice(pkg.length).startsWith("@")) {
    version = full.slice(pkg.length + 1).split("/")[0];
  }

  return { pkg, version };
}
