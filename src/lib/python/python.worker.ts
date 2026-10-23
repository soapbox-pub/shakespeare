import { installPythonNetwork, setPythonCorsProxy } from './network';
import { PYODIDE_INDEX_URL, PythonService, type PyodideAPI, type PythonRequest } from './runPython';

installPythonNetwork(self);

const service = new PythonService(async () => {
  const { loadPyodide } = await import(/* @vite-ignore */ `${PYODIDE_INDEX_URL}pyodide.mjs`);
  return loadPyodide({ indexURL: PYODIDE_INDEX_URL, env: { HOME: '/home/pyodide' } }) as Promise<PyodideAPI>;
});

self.onmessage = async (event: MessageEvent<{ id: number; request: PythonRequest }>) => {
  const { id, request } = event.data;
  setPythonCorsProxy(request.corsProxy);
  try {
    const result = await service.run(request, () => self.postMessage({ id, started: true }));
    const buffers = Object.values(result.writes).map((data) => data.buffer as ArrayBuffer);
    self.postMessage({ id, result }, { transfer: buffers });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
