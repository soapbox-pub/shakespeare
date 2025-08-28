/**
 * Adds a markdown extension to the URL according to the
 * [llms.txt](https://llmstxt.org/) specification.
 */
export function llmstxtUrl(url: URL | string): URL {
  url = new URL(url);

  if (url.pathname.endsWith('.md')) {
    return url;
  }

  if (url.pathname.endsWith('/')) {
    url.pathname += 'index.md';
  } else {
    url.pathname += '.md';
  }

  return url;
}