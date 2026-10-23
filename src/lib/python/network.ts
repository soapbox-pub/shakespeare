import { proxyUrl } from '../proxyUrl';

/** Hosts reached directly: they allow CORS, and Pyodide and micropip load packages from them. */
const DIRECT_HOSTS = new Set(['cdn.jsdelivr.net', 'pypi.org', 'files.pythonhosted.org']);

/**
 * The URL a request from Python should go to: other sites are reached
 * through the CORS proxy, as `curl` does, since most of them don't allow
 * cross-origin requests.
 */
export function pythonRequestUrl(url: string, base: string, corsProxy: string | undefined): string {
  if (!corsProxy) return url;
  let parsed: URL;
  try {
    parsed = new URL(url, base);
  } catch {
    return url;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return url;
  if (parsed.origin === new URL(base).origin || DIRECT_HOSTS.has(parsed.hostname)) return url;
  const proxied = proxyUrl({ template: corsProxy, url: parsed });
  // Already a request to the proxy.
  if (new URL(proxied, base).origin === parsed.origin) return url;
  return proxied;
}

let corsProxy: string | undefined;

/** Set the proxy that `fetch` and `XMLHttpRequest` in this worker send requests through. */
export function setPythonCorsProxy(template: string | undefined): void {
  corsProxy = template;
}

/** Route the worker's `fetch` and `XMLHttpRequest` through `pythonRequestUrl`. */
export function installPythonNetwork(scope: typeof globalThis): void {
  const base = scope.location.href;
  const rewrite = (url: string) => pythonRequestUrl(url, base, corsProxy);

  const fetch = scope.fetch.bind(scope);
  scope.fetch = (input, init) => {
    if (input instanceof Request) return fetch(new Request(rewrite(input.url), input), init);
    return fetch(rewrite(String(input)), init);
  };

  const open = scope.XMLHttpRequest.prototype.open as (this: XMLHttpRequest, ...args: unknown[]) => void;
  scope.XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    open.call(this, method, rewrite(String(url)), ...rest);
  };
}
