import * as JSONC from "jsonc-parser";
import { join } from "path-browserify";
import { getEsbuild } from "@/lib/esbuild";
import { copyFiles } from "@/lib/copyFiles";
import { addDomainToCSP } from "@/lib/csp";

import { shakespearePlugin } from "./shakespearePlugin";
import { esmPlugin } from "./esmPlugin";
import { fsPlugin } from "./fsPlugin";
import { convertYarnLockToPackageLock } from "./yarnLockConverter";

import type { JSRuntimeFS } from '@/lib/JSRuntime';

export interface BuildProjectOptions {
  fs: JSRuntimeFS;
  projectPath: string;
  domParser: DOMParser;
  target?: string;
  outputPath?: string;
  esmUrl: string;
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

  // Read package.json
  let packageJson;
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

  // Try to read package-lock.json first, fall back to yarn.lock
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
      // If neither exists, use empty packages object
      packageLock = { packages: {} };
      buildMode = "package.json only (no lock file)";
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