import type _ESBuild from "esbuild-wasm";

type ESBuild = typeof _ESBuild;

let promise: Promise<ESBuild> | undefined;

export function getEsbuild(esmUrl: string): Promise<ESBuild> {
  if (!promise) {
    promise = loadEsbuild(esmUrl);
  }
  return promise;
}

async function loadEsbuild(esmUrl: string): Promise<ESBuild> {
  const { default: esbuild } = await import("esbuild-wasm");

  await esbuild.initialize({
    worker: false,
    wasmURL: `${esmUrl}/esbuild-wasm@0.25.8/esbuild.wasm`,
  });

  return esbuild;
}