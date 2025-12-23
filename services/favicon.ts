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
    
    // AI-provider-specific hacks
    let hostname = url.hostname;
    if (url.host === 'localhost:11434' || url.origin === '127.0.0.1:11434') {
      hostname = 'ollama.com';
    } else if (url.host === 'generativelanguage.googleapis.com') {
      hostname = 'gemini.google.com';
    } else if (url.host === 'api.z.ai') {
      hostname = 'docs.z.ai';
    }

    // Strip `ai.` and `api.` subdomains for a better chance at finding a favicon
    hostname = hostname.replace(/^(ai\.|api\.)/, '');

    // Fetch the favicon from DuckDuckGo's service
    return fetch(`https://external-content.duckduckgo.com/ip3/${hostname}.ico`);
  },
};