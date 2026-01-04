/**
 * Favicon Proxy Service
 * 
 * Proxies favicon requests to DuckDuckGo's favicon service.
 * This allows fetching favicons for any domain without CORS issues.
 * 
 * Usage: GET /favicon?url=https://example.com
 * Returns: The favicon image for the specified domain
 */

export default {
  async fetch(request: Request): Promise<Response> {
    const requestUrl = new URL(request.url);
    const targetUrl = requestUrl.searchParams.get('url');

    if (!targetUrl) {
      return new Response('Missing url parameter', { status: 400 });
    }

    let url: URL;
    try {
      url = new URL(targetUrl);
    } catch {
      return new Response('Invalid url parameter', { status: 400 });
    }

    let hostname = url.hostname;

    // Strip `ai.` and `api.` subdomains for a better chance at finding a favicon
    hostname = hostname.replace(/^(ai\.|api\.)/, '');

    // GitHub hack: neutral color for light/dark mode
    if (hostname === 'github.com') {
      const svg = await (await fetch('https://github.githubassets.com/favicons/favicon.svg')).text();
      return new Response(svg.replaceAll('#24292E', '#808080'), {
        headers: { 'Content-Type': 'image/svg+xml' },
      });
    }
    
    // AI-provider-specific hacks
    if (url.host === 'localhost:11434' || url.origin === '127.0.0.1:11434') {
      hostname = 'ollama.com';
    } else if (url.host === 'localhost:45554' || url.origin === '127.0.0.1:45554') {
      hostname = 'claude.ai';
    } else if (url.host === 'generativelanguage.googleapis.com') {
      hostname = 'gemini.google.com';
    } else if (url.host === 'z.ai') {
      hostname = 'docs.z.ai';
    }

    // Fetch the favicon from DuckDuckGo's service
    return fetch(`https://external-content.duckduckgo.com/ip3/${hostname}.ico`);
  },
};