import * as JSONC from "jsonc-parser";
import { join } from "path-browserify";
import { getEsbuild } from "@/lib/esbuild";
import { copyFiles } from "@/lib/copyFiles";
import { addDomainToCSP } from "@/lib/csp";

import { shakespearePlugin } from "./shakespearePlugin";
import { esmPlugin } from "./esmPlugin";
import { fsPlugin } from "./fsPlugin";
import type { WorkerMatch, AssetMatch } from "./workerPlugin";

import { readLockfile, type PackageLock } from '@/lib/lockfile';
import type { JSRuntimeFS } from '@/lib/JSRuntime';
import type { Plugin } from 'esbuild-wasm';

export interface BuildProjectOptions {
  fs: JSRuntimeFS;
  projectPath: string;
  domParser: DOMParser;
  target?: string;
  outputPath?: string;
  esmUrl: string;
}

export interface PackageJson {
  dependencies?: { [key: string]: string };
  devDependencies?: { [key: string]: string };
  peerDependencies?: { [key: string]: string };
}

export type { PackageLock };

export interface TsConfig {
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
}

export interface BuildContext {
  packageJson: PackageJson;
  packageLock: PackageLock;
  tsconfig?: TsConfig;
}

/** Tailwind CSS variant used by a project (or `null` if Tailwind is not enabled). */
export type TailwindVariant = "v3" | "v4" | null;

/**
 * Detect which major version of Tailwind CSS a project uses by inspecting the
 * `tailwindcss` entry in package.json (dependencies, devDependencies, or
 * peerDependencies). Returns `null` when no Tailwind dependency is declared.
 *
 * The version string is matched loosely: any leading non-digit characters
 * (such as `^`, `~`, `>=`, or `v`) are stripped before reading the major
 * number. Ranges like `>=3.0.0 <5.0.0`, git URLs, or other non-standard
 * specifiers fall through to `null`, which callers should treat as "skip
 * Tailwind injection entirely".
 */
export function detectTailwindVariant(packageJson: PackageJson): TailwindVariant {
  const spec =
    packageJson.dependencies?.tailwindcss ??
    packageJson.devDependencies?.tailwindcss ??
    packageJson.peerDependencies?.tailwindcss;

  if (!spec) return null;

  const match = spec.match(/(\d+)/);
  if (!match) return null;

  const major = Number(match[1]);
  if (major >= 4) return "v4";
  if (major === 3) return "v3";
  return null;
}

/**
 * Read package.json, the lockfile, and tsconfig.json from project
 * Exported for use by deployment adapters that need to bundle workers
 */
export async function readBuildContext(
  fs: JSRuntimeFS,
  projectPath: string,
): Promise<BuildContext> {
  // Read package.json
  let packageJson: PackageJson;
  try {
    const packageJsonText = await fs.readFile(
      `${projectPath}/package.json`,
      "utf8",
    );
    packageJson = JSON.parse(packageJsonText);
  } catch {
    packageJson = {};
  }

  // Try to read tsconfig.json
  let tsconfig: TsConfig | undefined;
  try {
    const tsconfigText = await fs.readFile(
      `${projectPath}/tsconfig.json`,
      "utf8",
    );
    tsconfig = JSONC.parse(tsconfigText);
  } catch {
    // tsconfig.json is optional
    tsconfig = undefined;
  }

  const found = await readLockfile(
    (file) => fs.readFile(`${projectPath}/${file}`, "utf8").catch(() => undefined),
    packageJson,
  );
  const packageLock = found?.lock ?? { packages: {} };
  console.log(found ? `Building with ${found.file}` : `Building with package.json only (no lock file)`);

  return { packageJson, packageLock, tsconfig };
}

export interface CreatePluginsOptions {
  /**
   * When provided, the fs plugin will scan source files for
   * `new Worker(new URL(..., import.meta.url))` patterns and push
   * matches here so the caller can build them as additional entry
   * points.
   */
  collectWorkers?: WorkerMatch[];
  /**
   * When provided, the fs plugin will scan source files for
   * `new URL(..., import.meta.url)` patterns referencing non-source
   * assets and push matches here so the caller can copy them into
   * the output.
   */
  collectAssets?: AssetMatch[];
}

/**
 * Create the common esbuild plugins for both project and worker builds
 * Exported for use by deployment adapters that need to bundle workers
 */
export function createPlugins(
  fs: JSRuntimeFS,
  projectPath: string,
  context: BuildContext,
  esmUrl: string,
  target?: string,
  pluginOptions: CreatePluginsOptions = {},
): Plugin[] {
  return [
    shakespearePlugin({ esmUrl }),
    fsPlugin({
      fs,
      cwd: projectPath,
      tsconfig: context.tsconfig,
      packageJson: context.packageJson,
      collectWorkers: pluginOptions.collectWorkers,
      collectAssets: pluginOptions.collectAssets,
    }),
    esmPlugin({ packageJson: context.packageJson, packageLock: context.packageLock, target, esmUrl }),
  ];
}

async function bundle(
  options: BuildProjectOptions,
): Promise<Record<string, Uint8Array>> {
  const { fs, projectPath, domParser, target = "esnext", esmUrl } = options;
  const esbuild = await getEsbuild();

  const indexHtmlText = await fs.readFile(
    `${projectPath}/index.html`,
    "utf8",
  );

  // Read build context (package.json, package-lock.json, tsconfig.json)
  const context = await readBuildContext(fs, projectPath);

  const doc = domParser.parseFromString(indexHtmlText, "text/html");
  const entryPoints: string[] = [];
  const entryScripts: Record<string, HTMLScriptElement> = {};

  // Find all module scripts with relative paths in index.html
  for (const script of doc.scripts) {
    const scriptSrc = script.getAttribute("src");

    if (scriptSrc && script.type === "module" && /^[./]/.test(scriptSrc)) {
      const path = join(projectPath, scriptSrc);

      // Files in the public directory take precedence over source files
      if (scriptSrc.startsWith("/")) {
        if (await fileExists(fs, join(projectPath, "public", scriptSrc))) {
          continue;
        }
      }

      entryPoints.push(path);
      entryScripts[path] = script;
    }
  }

  // Enable Tailwind CSS based on the version declared in package.json.
  // v3 needs a synthetic entry that loads the Play CDN runtime and assigns
  // the project's tailwind.config.{js,ts} to `window.tailwind.config`.
  // v4 has no JS config (theming is CSS-based via `@theme`) and the
  // `@tailwindcss/browser@4` runtime auto-scans the document, so the shim
  // just needs to side-effect-import the runtime.
  const tailwindVariant = detectTailwindVariant(context.packageJson);
  if (tailwindVariant === "v3") {
    for (const path of ["tailwind.config.ts", "tailwind.config.js"]) {
      if (await fileExists(fs, join(projectPath, path))) {
        entryPoints.push(`shakespeare:${path}`);
        break;
      }
    }
  } else if (tailwindVariant === "v4") {
    entryPoints.push("shakespeare:tailwindcss@4");
  }

  const collectedWorkers: WorkerMatch[] = [];
  const collectedAssets: AssetMatch[] = [];

  const results = await esbuild.build({
    entryPoints,
    bundle: true,
    write: false,
    format: "esm",
    target,
    outdir: "/",
    jsx: "automatic",
    metafile: true,
    sourcemap: true,
    entryNames: "[name]-[hash]",
    chunkNames: "[name]-[hash]",
    assetNames: "[name]-[hash]",
    plugins: createPlugins(fs, projectPath, context, esmUrl, target, {
      collectWorkers: collectedWorkers,
      collectAssets: collectedAssets,
    }),
    define: {
      "import.meta.env": JSON.stringify({}),
    },
  });

  const dist: Record<string, Uint8Array> = {};

  for (const file of results.outputFiles) {
    const ext = file.path.split('.').pop();
    const filename = `${file.path.slice(1)}`;
    const entryPoint = results.metafile.outputs[filename]?.entryPoint?.replace(/^fs:/, '');
    const script = entryPoint ? entryScripts[entryPoint] : null;

    if (script) {
      script.setAttribute("src", "/" + filename);
      dist[filename] = file.contents;
    } else if (ext === "js") {
      const script = document.createElement("script");
      script.type = "module";
      script.src = "/" + filename;
      doc.head.appendChild(script);
      dist[filename] = file.contents;
    } else if (ext === "css") {
      // Embed stylesheets as Tailwind CSS styles
      const style = doc.createElement("style");
      style.setAttribute("type", "text/tailwindcss");
      style.textContent = file.text;
      doc.head.appendChild(style);
    } else {
      dist[filename] = file.contents;
    }
  }

  // Build each unique collected worker as its own ESM chunk, looping
  // to pick up any nested workers / assets they themselves collect.
  // Each iteration passes the same collector arrays so newly
  // discovered entries feed the next iteration.
  const placeholderToFilename = new Map<string, string>();
  const workerQueue: WorkerMatch[] = [...collectedWorkers];
  const seenWorkerPaths = new Set<string>();

  while (workerQueue.length > 0) {
    const nextBatch = workerQueue.splice(0, workerQueue.length);
    for (const worker of nextBatch) {
      if (seenWorkerPaths.has(worker.resolvedPath)) {
        // Reuse the output from the prior build of this same worker.
        const existing = findPlaceholderForPath(placeholderToFilename, worker.resolvedPath);
        if (existing) {
          placeholderToFilename.set(worker.placeholder, existing);
        }
        continue;
      }
      seenWorkerPaths.add(worker.resolvedPath);

      const before = {
        workers: collectedWorkers.length,
        assets: collectedAssets.length,
      };

      const workerResult = await esbuild.build({
        entryPoints: [worker.resolvedPath],
        bundle: true,
        write: false,
        format: "esm",
        target,
        outdir: "/",
        jsx: "automatic",
        metafile: true,
        sourcemap: true,
        entryNames: "[name]-[hash]",
        chunkNames: "[name]-[hash]",
        assetNames: "[name]-[hash]",
        plugins: createPlugins(fs, projectPath, context, esmUrl, target, {
          collectWorkers: collectedWorkers,
          collectAssets: collectedAssets,
        }),
        define: {
          "import.meta.env": JSON.stringify({}),
        },
      });

      let entryFilename: string | undefined;
      for (const file of workerResult.outputFiles) {
        const filename = file.path.slice(1);
        dist[filename] = file.contents;
        const outMeta = workerResult.metafile.outputs[filename];
        if (outMeta?.entryPoint && !entryFilename && filename.endsWith(".js")) {
          entryFilename = filename;
        }
      }
      if (!entryFilename) {
        // Fall back to the first .js output.
        const firstJs = workerResult.outputFiles.find((f) => f.path.endsWith(".js"));
        if (firstJs) entryFilename = firstJs.path.slice(1);
      }
      if (!entryFilename) {
        throw new Error(`Failed to bundle worker: ${worker.resolvedPath}`);
      }

      // Record placeholder -> "./<filename>" so main-bundle rewrites
      // produce URLs that resolve correctly against import.meta.url
      // of the main bundle (which lives at the same origin/dir).
      placeholderToFilename.set(worker.placeholder, "./" + entryFilename);
      // Record the file path -> filename mapping in a secondary index
      // via the placeholder (so the dedup branch above can find it).
      placeholderToFilename.set(`@path:${worker.resolvedPath}`, entryFilename);

      // New workers / assets discovered during this sub-build get
      // queued.
      if (collectedWorkers.length > before.workers) {
        workerQueue.push(...collectedWorkers.slice(before.workers));
      }
    }
  }

  // Copy each unique collected asset into the output directory with
  // a content-hashed filename.
  const assetPathToFilename = new Map<string, string>();
  for (const asset of collectedAssets) {
    let outName = assetPathToFilename.get(asset.resolvedPath);
    if (!outName) {
      const bytes = await fs.readFile(asset.resolvedPath);
      const data = bytes instanceof Uint8Array ? bytes : new TextEncoder().encode(String(bytes));
      const hash = await shortContentHash(data);
      const base = asset.resolvedPath.split("/").pop() ?? "asset";
      const dot = base.lastIndexOf(".");
      const stem = dot > 0 ? base.slice(0, dot) : base;
      const ext = dot > 0 ? base.slice(dot) : "";
      outName = `${stem}-${hash}${ext}`;
      dist[outName] = data;
      assetPathToFilename.set(asset.resolvedPath, outName);
    }
    placeholderToFilename.set(asset.placeholder, "./" + outName);
  }

  // Substitute placeholders in every JS output file.
  if (placeholderToFilename.size > 0) {
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    for (const [filename, contents] of Object.entries(dist)) {
      if (!filename.endsWith(".js")) continue;
      let text = decoder.decode(contents);
      let changed = false;
      for (const [placeholder, replacement] of placeholderToFilename) {
        if (placeholder.startsWith("@path:")) continue;
        if (text.includes(placeholder)) {
          text = text.split(placeholder).join(replacement.startsWith("./") ? replacement.slice(2) : replacement);
          changed = true;
        }
      }
      if (changed) {
        dist[filename] = encoder.encode(text);
      }
    }
  }

  // Parse CSP and ensure ESM CDN is allowed for necessary directives.
  // If any workers were emitted, also extend worker-src / child-src so
  // the browser permits module workers and workers importing from the
  // ESM CDN.
  const cspMeta = doc.querySelector("meta[http-equiv=\"content-security-policy\"]");
  if (cspMeta) {
    const cspContent = cspMeta.getAttribute("content");
    if (cspContent) {
      const updatedCSP = updateCSPForEsmSh(cspContent, esmUrl, {
        emittedWorkers: collectedWorkers.length > 0,
      });
      cspMeta.setAttribute("content", updatedCSP);
    }
  }

  const updatedHtml = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  dist["index.html"] = new TextEncoder().encode(updatedHtml);

  return dist;
}

function findPlaceholderForPath(
  placeholderToFilename: Map<string, string>,
  resolvedPath: string,
): string | undefined {
  const key = `@path:${resolvedPath}`;
  const filename = placeholderToFilename.get(key);
  return filename ? "./" + filename : undefined;
}

async function shortContentHash(data: Uint8Array): Promise<string> {
  // Use SubtleCrypto if available (browsers, modern Node via webcrypto
  // global); fall back to a simple non-cryptographic hash for test
  // environments that stub out crypto.
  try {
    const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
    if (subtle?.digest) {
      const buf = await subtle.digest("SHA-256", data);
      const bytes = new Uint8Array(buf);
      let hex = "";
      for (let i = 0; i < 8; i++) {
        hex += bytes[i].toString(16).padStart(2, "0");
      }
      return hex;
    }
  } catch {
    // fall through
  }
  // FNV-1a-ish fallback (good enough for filename uniqueness).
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i];
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Build project and write output files to the filesystem
 */
export async function buildProject(options: BuildProjectOptions): Promise<{
  files: Record<string, Uint8Array>;
  outputPath: string;
  projectId?: string;
}> {
  const { fs, projectPath, outputPath = `${projectPath}/dist` } = options;

  // Check if index.html exists
  try {
    await fs.readFile(`${projectPath}/index.html`, "utf8");
  } catch {
    throw new Error(`❌ Could not find index.html at ${projectPath}. This is required for building the project.`);
  }

  // Run the build
  const dist = await bundle(options);

  // Delete all existing files in output directory
  try {
    const distFiles = await fs.readdir(outputPath);
    for (const file of distFiles) {
      await fs.unlink(`${outputPath}/${file}`);
    }
  } catch {
    // Ignore errors (e.g., directory doesn't exist)
  }

  // Create output directory if it doesn't exist
  await fs.mkdir(outputPath, { recursive: true });

  // Write all built files to output directory
  for (const [path, contents] of Object.entries(dist)) {
    await fs.writeFile(`${outputPath}/${path}`, contents);
  }

  // Copy files from public directory if it exists
  try {
    const publicPath = `${projectPath}/public`;
    const stat = await fs.stat(publicPath);
    if (stat.isDirectory()) {
      await copyFiles(fs, fs, publicPath, outputPath);
    }
  } catch {
    // Public directory doesn't exist, which is fine
  }

  // Copy NIP.md if it exists in project root
  try {
    const nipMdPath = `${projectPath}/NIP.md`;
    const nipMdStat = await fs.stat(nipMdPath);
    if (nipMdStat.isFile()) {
      const nipMdContent = await fs.readFile(nipMdPath);
      await fs.writeFile(`${outputPath}/NIP.md`, nipMdContent);
    }
  } catch {
    // NIP.md doesn't exist, which is fine
  }

  // Extract project ID from the project path
  // Expected format: /projects/{projectId}
  const projectId = projectPath.split('/').pop();

  // Emit build completion event for PreviewPane to listen to
  if (projectId && typeof window !== 'undefined') {
    const buildCompleteEvent = new CustomEvent('buildComplete', {
      detail: { projectId }
    });
    window.dispatchEvent(buildCompleteEvent);
  }

  return {
    files: dist,
    outputPath,
    projectId,
  };
}

async function fileExists(fs: JSRuntimeFS, path: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path);
    return stat.isFile();
  } catch {
    return false;
  }
}

/** Updates CSP to allow ESM CDN for scripts, assets, fonts, and CSS */
export function updateCSPForEsmSh(
  csp: string,
  esmUrl: string,
  options: { emittedWorkers?: boolean } = {},
): string {
  const esmDirectives = [
    'script-src',     // For JavaScript modules
    'img-src',        // For images
    'media-src',      // For video/audio
    'font-src',       // For fonts
    'style-src',      // For CSS
    'connect-src',    // For fetch/XHR requests to ESM CDN
  ];

  let updated = addDomainToCSP(csp, esmUrl, esmDirectives);

  if (options.emittedWorkers) {
    // Module workers load from the same origin; when they import from
    // the ESM CDN, worker-src (and child-src for older browsers) must
    // list the CDN as well. These directives may not exist in the
    // project's CSP, so seed them before extending.
    updated = ensureDirective(updated, 'worker-src');
    updated = ensureDirective(updated, 'child-src');
    updated = addDomainToCSP(updated, esmUrl, ['worker-src', 'child-src']);
  }

  return updated;
}

/**
 * Ensure a CSP directive exists. If absent, seed it with `'self'` so
 * subsequent `addDomainToCSP` calls have something to extend.
 */
function ensureDirective(csp: string, directive: string): string {
  const re = new RegExp(`(^|;)\\s*${directive}\\s`);
  if (re.test(csp)) return csp;
  const trimmed = csp.trim().replace(/;\s*$/, '');
  return trimmed ? `${trimmed}; ${directive} 'self'` : `${directive} 'self'`;
}