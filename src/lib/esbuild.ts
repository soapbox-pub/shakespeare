import type _ESBuild from "esbuild-wasm";
import wasmUrl from "esbuild-wasm/esbuild.wasm?url" with { type: "url" };

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
    worker: true,
    wasmURL: wasmUrl,
  });

  return esbuild;
}