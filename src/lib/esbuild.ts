import type _ESBuild from "esbuild-wasm";
import wasmUrl from "esbuild-wasm/esbuild.wasm?url";

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
    // A service worker can't start Web Workers, so there esbuild runs on its own thread.
    worker: typeof Worker !== "undefined",
    wasmURL: wasmUrl,
  });

  return esbuild;
}