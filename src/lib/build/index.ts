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

  const results = await esbuild.build({
    stdin: {
      contents: `
        import "@/main.tsx";
        import tailwindConfig from "@/../tailwind.config.ts";
        import "https://esm.sh/tailwindcss-cdn@3";
        tailwind.config = tailwindConfig;
      `,
      loader: "tsx",
    },
    bundle: true,
    write: false,
    format: "esm",
    target,
    outdir: "/",
    jsx: "automatic",
    plugins: [
      shakespearePlugin(), // Takes precedence over esmPlugin
      fsPlugin(fs, `${projectPath}/src`),
      esmPlugin(JSON.parse(packageLockText), target),
    ],
    define: {
      "import.meta.env": JSON.stringify({}),
    },
  });

  const dist: Record<string, Uint8Array> = {};

  for (const file of results.outputFiles) {
    const relativePath = file.path.replace(/^\//, "");
    if (relativePath === "stdin.js") {
      dist["main.js"] = file.contents;
    } else if (relativePath === "stdin.css") {
      dist["main.css"] = file.contents;
    } else {
      dist[relativePath] = file.contents;
    }
  }

  // Update index.html with proper script and link tags
  updateIndexHtml(doc, dist);

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

function updateIndexHtml(doc: Document, dist: Record<string, Uint8Array>): void {
  const entrypoint = doc.querySelector('script[src="/src/main.tsx"]');

  if (!entrypoint) {
    throw new Error("No entrypoint script found in index.html");
  }

  entrypoint.setAttribute("src", "/main.js");

  const css = dist["main.css"];
  if (css) {
    const style = doc.createElement("style");
    style.setAttribute("type", "text/tailwindcss");
    style.textContent = new TextDecoder().decode(css);
    doc.head.appendChild(style);
  }
}