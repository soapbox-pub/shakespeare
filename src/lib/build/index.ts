import { join } from "path-browserify";
import { getEsbuild } from "@/lib/esbuild";
import { copyFiles } from "@/lib/copyFiles";

import { shakespearePlugin } from "./shakespearePlugin";
import { esmPlugin } from "./esmPlugin";
import { fsPlugin } from "./fsPlugin";

import type { JSRuntimeFS } from '@/lib/JSRuntime';

export interface BuildProjectOptions {
  fs: JSRuntimeFS;
  projectPath: string;
  domParser: DOMParser;
  target?: string;
  outputPath?: string;
}

async function bundle(
  options: BuildProjectOptions,
): Promise<Record<string, Uint8Array>> {
  const esbuild = await getEsbuild();

  const { fs, projectPath, domParser, target = "esnext" } = options;

  const indexHtmlText = await fs.readFile(
    `${projectPath}/index.html`,
    "utf8",
  );
  const packageLockText = await fs.readFile(
    `${projectPath}/package-lock.json`,
    "utf8",
  );

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
    plugins: [
      shakespearePlugin(),
      fsPlugin(fs, `${projectPath}/src`),
      esmPlugin(JSON.parse(packageLockText), target),
    ],
    define: {
      "import.meta.env": JSON.stringify({}),
    },
  });

  const dist: Record<string, Uint8Array> = {};

  for (const file of results.outputFiles) {
    const ext = file.path.split('.').pop();
    const filename = `${file.path.split('/').pop()?.split('.')?.[0] || "chunk"}-${file.hash}.${ext}`;
    const entryPoint = results.metafile.outputs[file.path.slice(1)]?.entryPoint?.replace(/^fs:/, '');
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
    }
  }

  // HACK: Remove existing CSP header for now.
  // TODO: Parse CSP and ensure esm.sh is allowed.
  doc.querySelector("meta[http-equiv=\"content-security-policy\"]")?.remove();

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