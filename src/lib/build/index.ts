import * as JSONC from "jsonc-parser";
import { join } from "path-browserify";
import { getEsbuild } from "@/lib/esbuild";
import { copyFiles } from "@/lib/copyFiles";
import { addDomainToCSP } from "@/lib/csp";

import { shakespearePlugin } from "./shakespearePlugin";
import { esmPlugin } from "./esmPlugin";
import { fsPlugin } from "./fsPlugin";
import { sveltePlugin } from "./sveltePlugin";
import { convertYarnLockToPackageLock } from "./yarnLockConverter";
import { convertPnpmLockToPackageLock } from "./pnpmLockConverter";

import type { JSRuntimeFS } from '@/lib/JSRuntime';

export interface BuildProjectOptions {
  fs: JSRuntimeFS;
  projectPath: string;
  domParser: DOMParser;
  target?: string;
  outputPath?: string;
  esmUrl: string;
}

/**
 * Bundle a SvelteKit project
 */
async function bundleSvelteKit(
  options: BuildProjectOptions,
): Promise<Record<string, Uint8Array>> {
  const { fs, projectPath, domParser, target = "esnext", esmUrl } = options;
  const esbuild = await getEsbuild(esmUrl);

  // Read app.html template
  const appHtmlText = await fs.readFile(
    `${projectPath}/src/app.html`,
    "utf8",
  );

  // Read package.json
  const packageJsonText = await fs.readFile(
    `${projectPath}/package.json`,
    "utf8",
  );
  const packageJson = JSON.parse(packageJsonText);

  // Try to read tsconfig.json
  let tsconfig;
  try {
    const tsconfigText = await fs.readFile(
      `${projectPath}/tsconfig.json`,
      "utf8",
    );
    tsconfig = JSONC.parse(tsconfigText);
  } catch {
    tsconfig = undefined;
  }

  // Extract aliases from svelte.config.js and merge with tsconfig paths
  const svelteAliases = await extractSvelteAliases(fs, projectPath);

  // Always add default SvelteKit $lib alias
  const defaultSvelteAliases: Record<string, string> = {
    '$lib': 'src/lib',
    '$lib/*': 'src/lib/*',
  };

  const allSvelteAliases = { ...defaultSvelteAliases, ...svelteAliases };

  if (Object.keys(allSvelteAliases).length > 0) {
    // Convert Svelte aliases to tsconfig paths format
    const pathsFromAliases: Record<string, string[]> = {};

    for (const [alias, path] of Object.entries(allSvelteAliases)) {
      // Handle different alias formats:
      // 'my-file' -> 'path/to/file.js' becomes 'my-file': ['path/to/file.js']
      // 'my-dir' -> 'path/to/dir' becomes 'my-dir/*': ['path/to/dir/*']
      // 'my-dir/*' -> 'path/to/dir/*' stays as is

      if (alias.endsWith('/*')) {
        pathsFromAliases[alias] = [path];
      } else if (path.includes('.')) {
        // Likely a file
        pathsFromAliases[alias] = [path];
      } else {
        // Likely a directory - add /* for directory resolution
        pathsFromAliases[`${alias}/*`] = [`${path}/*`];
        // Also add exact match for the directory itself
        pathsFromAliases[alias] = [path];
      }
    }

    // Merge with existing tsconfig paths
    if (!tsconfig) {
      tsconfig = { compilerOptions: {} };
    }
    if (!tsconfig.compilerOptions) {
      tsconfig.compilerOptions = {};
    }

    tsconfig.compilerOptions.paths = {
      ...pathsFromAliases,
      ...tsconfig.compilerOptions.paths, // tsconfig paths take precedence
    };

    console.log('Merged Svelte aliases into tsconfig paths:', tsconfig.compilerOptions.paths);
  }

  // Try to read package-lock.json first, fall back to yarn.lock, then pnpm-lock.yaml
  let packageLock;
  let buildMode: string;
  try {
    const packageLockText = await fs.readFile(
      `${projectPath}/package-lock.json`,
      "utf8",
    );
    packageLock = JSON.parse(packageLockText);
    buildMode = "npm (package-lock.json)";
  } catch {
    try {
      const yarnLockText = await fs.readFile(
        `${projectPath}/yarn.lock`,
        "utf8",
      );
      packageLock = convertYarnLockToPackageLock(yarnLockText);
      buildMode = "yarn (yarn.lock)";
    } catch {
      try {
        const pnpmLockText = await fs.readFile(
          `${projectPath}/pnpm-lock.yaml`,
          "utf8",
        );
        packageLock = convertPnpmLockToPackageLock(pnpmLockText);
        buildMode = "pnpm (pnpm-lock.yaml)";
      } catch {
        packageLock = { packages: {} };
        buildMode = "package.json only (no lock file)";
      }
    }
  }

  console.log(`Building SvelteKit project with ${buildMode}`);

  // Find entry point - typically src/routes/+page.svelte or a layout
  const entryPoints: string[] = [];

  // Check for common SvelteKit entry points
  const possibleEntries = [
    join(projectPath, "src", "routes", "+layout.svelte"),
    join(projectPath, "src", "routes", "+page.svelte"),
  ];

  for (const entry of possibleEntries) {
    if (await fileExists(fs, entry)) {
      entryPoints.push(entry);
      break; // Use the first one found
    }
  }

  // If no entry found, scan the routes directory
  if (entryPoints.length === 0) {
    try {
      const routesPath = join(projectPath, "src", "routes");
      const routes = await fs.readdir(routesPath);

      for (const route of routes) {
        if (route.endsWith(".svelte")) {
          entryPoints.push(join(routesPath, route));
          break;
        }
      }
    } catch {
      throw new Error("Could not find SvelteKit entry point in src/routes/");
    }
  }

  // Build with esbuild
  const results = await esbuild.build({
    entryPoints,
    bundle: true,
    write: false,
    format: "esm",
    target,
    outdir: "/",
    metafile: true,
    sourcemap: true,
    entryNames: "[name]-[hash]",
    chunkNames: "[name]-[hash]",
    assetNames: "[name]-[hash]",
    plugins: [
      shakespearePlugin({ esmUrl }),
      sveltePlugin({ fs, projectPath }),
      fsPlugin({ fs, cwd: projectPath, tsconfig }),
      esmPlugin({ packageJson, packageLock, target, esmUrl }),
    ],
    define: {
      "import.meta.env": JSON.stringify({}),
    },
  });

  const dist: Record<string, Uint8Array> = {};
  const doc = domParser.parseFromString(appHtmlText, "text/html");

  // Track the main component file for mounting
  let mainComponentPath: string | undefined;

  // Process output files
  for (const file of results.outputFiles) {
    const ext = file.path.split('.').pop();
    const filename = `${file.path.slice(1)}`;
    const entryPoint = results.metafile.outputs[filename]?.entryPoint?.replace(/^fs:/, '');

    if (ext === "js") {
      // Track the main component for mounting
      if (entryPoint && entryPoints.includes(entryPoint)) {
        mainComponentPath = "/" + filename;
      }

      dist[filename] = file.contents;
    } else if (ext === "css") {
      const style = doc.createElement("link");
      style.rel = "stylesheet";
      style.href = "/" + filename;

      if (doc.head.textContent?.includes("%sveltekit.head%")) {
        doc.head.innerHTML = doc.head.innerHTML.replace("%sveltekit.head%", style.outerHTML);
      } else {
        doc.head.appendChild(style);
      }

      dist[filename] = file.contents;
    } else {
      dist[filename] = file.contents;
    }
  }

  // Create a mounting script for the Svelte component
  if (mainComponentPath) {
    // Get svelte version from package.json
    const svelteVersion = packageJson.dependencies?.svelte ||
                         packageJson.devDependencies?.svelte ||
                         '5';

    const mountScript = `
      import Component from '${mainComponentPath}';
      import { mount } from '${esmUrl}/svelte@${svelteVersion}';

      // Mount the component to the target element
      const target = document.getElementById('svelte') || document.body;
      mount(Component, { target });
    `;

    const mountScriptHash = Math.random().toString(36).substring(7);
    const mountScriptFilename = `mount-${mountScriptHash}.js`;
    dist[mountScriptFilename] = new TextEncoder().encode(mountScript);

    // Add the mount script to the HTML
    const script = document.createElement("script");
    script.type = "module";
    script.src = "/" + mountScriptFilename;
    doc.head.appendChild(script);
  }

  // Replace SvelteKit placeholders
  let htmlContent = doc.documentElement.outerHTML;

  // Replace common placeholders
  htmlContent = htmlContent.replace(/%sveltekit\.head%/g, "");
  htmlContent = htmlContent.replace(/%sveltekit\.body%/g, '<div id="svelte"></div>');
  htmlContent = htmlContent.replace(/%sveltekit\.assets%/g, "");
  htmlContent = htmlContent.replace(/%sveltekit\.nonce%/g, "");

  // Parse CSP and ensure ESM CDN is allowed
  const cspMeta = doc.querySelector("meta[http-equiv=\"content-security-policy\"]");
  if (cspMeta) {
    const cspContent = cspMeta.getAttribute("content");
    if (cspContent) {
      const updatedCSP = updateCSPForEsmSh(cspContent, esmUrl);
      htmlContent = htmlContent.replace(cspContent, updatedCSP);
    }
  }

  const updatedHtml = "<!DOCTYPE html>\n" + htmlContent;
  dist["index.html"] = new TextEncoder().encode(updatedHtml);

  return dist;
}

async function bundle(
  options: BuildProjectOptions,
): Promise<Record<string, Uint8Array>> {
  const { fs, projectPath, domParser, target = "esnext", esmUrl } = options;
  const esbuild = await getEsbuild(esmUrl);

  const indexHtmlText = await fs.readFile(
    `${projectPath}/index.html`,
    "utf8",
  );

  // Read package.json
  const packageJsonText = await fs.readFile(
    `${projectPath}/package.json`,
    "utf8",
  );
  const packageJson = JSON.parse(packageJsonText);

  // Try to read tsconfig.json
  let tsconfig;
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

  // Try to read package-lock.json first, fall back to yarn.lock, then pnpm-lock.yaml
  let packageLock;
  let buildMode: string;
  try {
    const packageLockText = await fs.readFile(
      `${projectPath}/package-lock.json`,
      "utf8",
    );
    packageLock = JSON.parse(packageLockText);
    buildMode = "npm (package-lock.json)";
  } catch {
    // If package-lock.json doesn't exist, try yarn.lock
    try {
      const yarnLockText = await fs.readFile(
        `${projectPath}/yarn.lock`,
        "utf8",
      );
      packageLock = convertYarnLockToPackageLock(yarnLockText);
      buildMode = "yarn (yarn.lock)";
    } catch {
      // If yarn.lock doesn't exist, try pnpm-lock.yaml
      try {
        const pnpmLockText = await fs.readFile(
          `${projectPath}/pnpm-lock.yaml`,
          "utf8",
        );
        packageLock = convertPnpmLockToPackageLock(pnpmLockText);
        buildMode = "pnpm (pnpm-lock.yaml)";
      } catch {
        // If no lock file exists, use empty packages object
        packageLock = { packages: {} };
        buildMode = "package.json only (no lock file)";
      }
    }
  }

  console.log(`Building with ${buildMode}`);

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

  // Enable Tailwind CSS if a config file is present
  for (const path of ["tailwind.config.ts", "tailwind.config.js"]) {
    if (await fileExists(fs, join(projectPath, path))) {
      entryPoints.push(`shakespeare:${path}`);
      break;
    }
  }

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
    plugins: [
      shakespearePlugin({ esmUrl }),
      fsPlugin({ fs, cwd: projectPath, tsconfig }),
      esmPlugin({ packageJson, packageLock, target, esmUrl }),
    ],
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

  // Parse CSP and ensure ESM CDN is allowed for necessary directives
  const cspMeta = doc.querySelector("meta[http-equiv=\"content-security-policy\"]");
  if (cspMeta) {
    const cspContent = cspMeta.getAttribute("content");
    if (cspContent) {
      const updatedCSP = updateCSPForEsmSh(cspContent, esmUrl);
      cspMeta.setAttribute("content", updatedCSP);
    }
  }

  const updatedHtml = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  dist["index.html"] = new TextEncoder().encode(updatedHtml);

  return dist;
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

  // Check if we're in a valid project directory
  try {
    await fs.readFile(`${projectPath}/package.json`, "utf8");
  } catch {
    throw new Error(`❌ Could not find package.json at ${projectPath}. Make sure you're in a valid project directory.`);
  }

  // Detect if this is a SvelteKit project
  const isSvelteKit = await isSvelteKitProject(fs, projectPath);

  let dist: Record<string, Uint8Array>;

  if (isSvelteKit) {
    // Check for src/app.html (required for SvelteKit)
    try {
      await fs.readFile(`${projectPath}/src/app.html`, "utf8");
    } catch {
      throw new Error(`❌ Could not find src/app.html at ${projectPath}. This is required for building SvelteKit projects.`);
    }

    console.log("🎭 Detected SvelteKit project");
    dist = await bundleSvelteKit(options);
  } else {
    // Check if index.html exists (required for React/Vite projects)
    try {
      await fs.readFile(`${projectPath}/index.html`, "utf8");
    } catch {
      throw new Error(`❌ Could not find index.html at ${projectPath}. This is required for building the project.`);
    }

    // Run the standard build
    dist = await bundle(options);
  }

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

  // Copy files from public directory (React/Vite) or static directory (SvelteKit)
  const staticDirs = isSvelteKit ? ["static"] : ["public"];

  for (const dirName of staticDirs) {
    try {
      const staticPath = `${projectPath}/${dirName}`;
      const stat = await fs.stat(staticPath);
      if (stat.isDirectory()) {
        await copyFiles(fs, fs, staticPath, outputPath);
      }
    } catch {
      // Static directory doesn't exist, which is fine
    }
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

/**
 * Extract aliases from svelte.config.js
 */
async function extractSvelteAliases(fs: JSRuntimeFS, projectPath: string): Promise<Record<string, string> | undefined> {
  try {
    // Try to read svelte.config.js
    let configPath: string | undefined;
    if (await fileExists(fs, join(projectPath, "svelte.config.js"))) {
      configPath = join(projectPath, "svelte.config.js");
    } else if (await fileExists(fs, join(projectPath, "svelte.config.ts"))) {
      configPath = join(projectPath, "svelte.config.ts");
    }

    if (!configPath) return undefined;

    const configText = await fs.readFile(configPath, "utf8");

    // Try to extract alias object using regex
    // Look for: alias: { ... }
    const aliasMatch = configText.match(/alias\s*:\s*\{([^}]+)\}/s);
    if (!aliasMatch) return undefined;

    const aliasContent = aliasMatch[1];
    const aliases: Record<string, string> = {};

    // Parse each alias line: 'key': 'value' or "key": "value"
    const aliasPattern = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
    let match;

    while ((match = aliasPattern.exec(aliasContent)) !== null) {
      const [, key, value] = match;
      aliases[key] = value;
    }

    return Object.keys(aliases).length > 0 ? aliases : undefined;
  } catch (error) {
    console.warn('Failed to extract Svelte aliases:', error);
    return undefined;
  }
}

/**
 * Detect if a project is a SvelteKit project
 */
async function isSvelteKitProject(fs: JSRuntimeFS, projectPath: string): Promise<boolean> {
  // Check for src/app.html (required for SvelteKit)
  const hasAppHtml = await fileExists(fs, join(projectPath, "src", "app.html"));

  // Check for svelte.config.js or svelte.config.ts
  const hasSvelteConfig =
    await fileExists(fs, join(projectPath, "svelte.config.js")) ||
    await fileExists(fs, join(projectPath, "svelte.config.ts"));

  // Check if index.html exists at root (indicates React/Vite project, not SvelteKit)
  const hasRootIndexHtml = await fileExists(fs, join(projectPath, "index.html"));

  // A project is considered SvelteKit if:
  // 1. It has app.html or svelte.config, AND
  // 2. It does NOT have a root index.html (which would indicate React/Vite)
  return (hasAppHtml || hasSvelteConfig) && !hasRootIndexHtml;
}

/** Updates CSP to allow ESM CDN for scripts, assets, fonts, and CSS */
export function updateCSPForEsmSh(csp: string, esmUrl: string): string {
  const esmDirectives = [
    'script-src',     // For JavaScript modules
    'img-src',        // For images
    'media-src',      // For video/audio
    'font-src',       // For fonts
    'style-src',      // For CSS
    'connect-src'     // For fetch/XHR requests to ESM CDN
  ];

  return addDomainToCSP(csp, esmUrl, esmDirectives);
}