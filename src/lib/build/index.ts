import * as esbuild from "esbuild-wasm";

import { esmPlugin } from "./esmPlugin";
import { fsPlugin } from "./fsPlugin";

import type { JSRuntimeFS } from '@/lib/JSRuntime';

const esbuildInitPromise = esbuild.initialize({
  worker: false,
  wasmURL: "https://esm.sh/esbuild-wasm@0.25.8/esbuild.wasm",
});

export interface BuildProjectOptions {
  fs: JSRuntimeFS;
  projectPath: string;
  domParser: DOMParser;
  target?: string;
}

export async function buildProject(
  options: BuildProjectOptions,
): Promise<Record<string, Uint8Array>> {
  await esbuildInitPromise;

  const { fs, projectPath, domParser, target } = options;

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
    target: target ?? "esnext",
    outdir: "/",
    jsx: "automatic",
    plugins: [
      fsPlugin(fs, `${projectPath}/src`),
      esmPlugin(JSON.parse(packageLockText), target),
    ],
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
  updateIndexHtml(doc);

  const updatedHtml = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  dist["index.html"] = new TextEncoder().encode(updatedHtml);

  return dist;
}

function updateIndexHtml(doc: Document): void {
  const entrypoint = doc.querySelector('script[src="/src/main.tsx"]');

  if (!entrypoint) {
    throw new Error("No entrypoint script found in index.html");
  }

  entrypoint.setAttribute("src", "/main.js");

  const style = doc.createElement("link");
  style.setAttribute("rel", "stylesheet");
  style.setAttribute("href", "/main.css");
  doc.head.appendChild(style);
}