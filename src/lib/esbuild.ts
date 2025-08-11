import type _ESBuild from "esbuild-wasm";

type ESBuild = typeof _ESBuild;

let promise: Promise<ESBuild> | undefined;

export function getEsbuild(): Promise<ESBuild> {
  if (!promise) {
    promise = loadEsbuild();
  }
  return promise;
}

async function loadEsbuild(): Promise<ESBuild> {
  const { default: esbuild } = await import("esbuild-wasm");

  await esbuild.initialize({
    worker: false,
    wasmURL: "https://esm.sh/esbuild-wasm@0.25.8/esbuild.wasm",
  });

  return esbuild;
}