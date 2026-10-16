import { encodeBase64 } from '@std/encoding/base64';

export interface PreviewResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  /** Base64-encoded body. */
  body: string | null;
}

export interface ServePreviewFileOptions {
  /** Read a file from the project's `dist` directory, e.g. `/index.html`. Throws if missing. */
  readDistFile: (path: string) => Promise<Uint8Array>;
  /** Scripts served at virtual paths and injected into every HTML response. */
  injectedScripts: Map<string, string>;
}

const MIME_TYPES: Record<string, string> = {
  'html': 'text/html',
  'js': 'application/javascript',
  'mjs': 'application/javascript',
  'css': 'text/css',
  'json': 'application/json',
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'svg': 'image/svg+xml',
  'ico': 'image/x-icon',
  'woff': 'font/woff',
  'woff2': 'font/woff2',
  'ttf': 'font/ttf',
  'eot': 'application/vnd.ms-fontobject',
  'txt': 'text/plain',
  'xml': 'application/xml',
  'pdf': 'application/pdf',
  'zip': 'application/zip',
};

export function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  return MIME_TYPES[ext || ''] || 'application/octet-stream';
}

/** Insert a script tag for each injected script at the top of `<head>`. */
export function injectScripts(html: string, scriptPaths: Iterable<string>): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const first = doc.head.firstChild;
  for (const path of scriptPaths) {
    const tag = doc.createElement('script');
    tag.src = path;
    doc.head.insertBefore(tag, first);
  }
  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}

function encodeText(text: string): string {
  return encodeBase64(new TextEncoder().encode(text));
}

function ok(contentType: string, body: string): PreviewResponse {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'Content-Type': contentType, 'Cache-Control': 'no-cache' },
    body,
  };
}

function notFound(message: string): PreviewResponse {
  return {
    status: 404,
    statusText: 'Not Found',
    headers: { 'Content-Type': 'text/plain' },
    body: encodeText(message),
  };
}

/**
 * Answer a preview fetch for `path` from the project's built `dist` directory,
 * with SPA fallback to `index.html` for paths that aren't static assets.
 */
export async function servePreviewFile(path: string, options: ServePreviewFileOptions): Promise<PreviewResponse> {
  const { readDistFile, injectedScripts } = options;

  const injectedScript = injectedScripts.get(path);
  if (injectedScript !== undefined) {
    return ok('application/javascript', encodeText(injectedScript));
  }

  try {
    const bytes = await readDistFile(path);
    const contentType = getContentType(path);
    if (contentType === 'text/html') {
      return ok(contentType, encodeText(injectScripts(new TextDecoder().decode(bytes), injectedScripts.keys())));
    }
    return ok(contentType, encodeBase64(bytes));
  } catch {
    // Static assets (paths with an extension) don't get the SPA fallback
    if (/\.[a-zA-Z0-9]+$/.test(path)) {
      return notFound(`Static asset not found: ${path}`);
    }
  }

  try {
    const bytes = await readDistFile('/index.html');
    return ok('text/html', encodeText(injectScripts(new TextDecoder().decode(bytes), injectedScripts.keys())));
  } catch {
    return notFound(`File not found: ${path}`);
  }
}
