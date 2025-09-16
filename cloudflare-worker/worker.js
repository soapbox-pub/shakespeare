/**
 * Cloudflare Worker for Shakespeare iframe-fetch-client proxy
 * 
 * This worker acts as a reverse proxy that:
 * 1. Removes X-Frame-Options and other headers that prevent iframe embedding
 * 2. Adds CORS headers for communication between iframe and parent
 * 3. Routes all subdomain requests to the deployed iframe-fetch-client
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname, hostname, method } = url;
    
    // Handle OPTIONS preflight requests for CORS
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        }
      });
    }
    
    // Extract project ID from subdomain (e.g., project123.your-domain.com)
    const subdomain = hostname.split('.')[0];
    console.log(`[${new Date().toISOString()}] Request for project: ${subdomain}, path: ${pathname}, method: ${method}`);
    
    // Route to your surge deployment (update this URL to your surge deployment)
    const surgeDomain = 'your-unique-name.surge.sh'; // TODO: Update this!
    const targetUrl = new URL(pathname, `https://${surgeDomain}`);
    
    // Copy request headers, excluding problematic ones
    const headers = new Headers();
    for (const [key, value] of request.headers.entries()) {
      // Skip headers that might cause issues
      if (!['host', 'origin', 'referer'].includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    }
    
    try {
      // Forward the request to surge
      const response = await fetch(targetUrl, {
        method: method,
        headers: headers,
        body: request.body,
        redirect: 'follow',
      });
      
      // Copy response headers but remove problematic ones
      const newHeaders = new Headers(response.headers);
      
      // Remove headers that prevent iframe embedding
      newHeaders.delete('X-Frame-Options');
      newHeaders.delete('Content-Security-Policy');
      newHeaders.delete('X-Content-Type-Options');
      newHeaders.delete('Strict-Transport-Security');
      
      // Add CORS headers for communication between iframe and parent
      newHeaders.set('Access-Control-Allow-Origin', '*');
      newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      newHeaders.set('Access-Control-Allow-Headers', '*');
      newHeaders.set('Access-Control-Allow-Credentials', 'false');
      
      // Ensure correct content types for specific file extensions
      if (pathname.endsWith('.js')) {
        newHeaders.set('Content-Type', 'application/javascript; charset=utf-8');
      } else if (pathname.endsWith('.mjs')) {
        newHeaders.set('Content-Type', 'application/javascript; charset=utf-8');
      } else if (pathname.endsWith('.css')) {
        newHeaders.set('Content-Type', 'text/css; charset=utf-8');
      } else if (pathname.endsWith('.html')) {
        newHeaders.set('Content-Type', 'text/html; charset=utf-8');
      } else if (pathname.endsWith('.json')) {
        newHeaders.set('Content-Type', 'application/json; charset=utf-8');
      } else if (pathname.endsWith('.svg')) {
        newHeaders.set('Content-Type', 'image/svg+xml');
      } else if (pathname.endsWith('.png')) {
        newHeaders.set('Content-Type', 'image/png');
      } else if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) {
        newHeaders.set('Content-Type', 'image/jpeg');
      }
      
      // Add security headers that are iframe-friendly
      newHeaders.set('X-Content-Type-Options', 'nosniff');
      
      // Log successful proxy
      console.log(`[${new Date().toISOString()}] Successfully proxied: ${response.status} ${response.statusText}`);
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Proxy error for ${targetUrl}:`, error);
      
      return new Response(JSON.stringify({
        error: 'Proxy error',
        message: error.message,
        url: targetUrl.toString(),
        timestamp: new Date().toISOString()
      }), {
        status: 502,
        statusText: 'Bad Gateway',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
  },
};