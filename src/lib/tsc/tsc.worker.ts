import { IndexedDBPackageCache, LayeredPackageCache } from './packages';
import { runTsc, type TscEnvironment, type TscRequest, type TypeScriptModule } from './runTsc';

const env: TscEnvironment = {
  cache: new LayeredPackageCache(typeof indexedDB === 'undefined' ? undefined : new IndexedDBPackageCache()),
  // typescript.js declares `var ts` at the top level and assigns the API to it.
  evaluateCompiler: (source) => new Function(`${source}\nreturn ts;`)() as TypeScriptModule,
};

self.onmessage = async (event: MessageEvent<{ id: number; request: TscRequest }>) => {
  const { id, request } = event.data;
  try {
    self.postMessage({ id, result: await runTsc(request, env) });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
