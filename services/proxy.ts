export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const target = url.searchParams.get("url");

    if (!target) {
      return new Response("Include a `url` query parameter", { status: 400 });
    }

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
          "access-control-allow-headers": "*", // Or specify specific headers
          "access-control-max-age": "86400", // Cache preflight for 24 hours
        }
      });
    }

    const headers = new Headers(request.headers);
    headers.set('user-agent', 'Shakespeare Proxy <https://proxy.shakespeare.diy/>');

    // Remove forbidden browser headers that cause issues with some services
    headers.delete('origin');
    headers.delete('referer');

    for (const header of headers.keys()) {
      if (header.startsWith('sec-')) {
        headers.delete(header);
      }
    }

    const targetResponse = await fetch(target, {
      method: request.method,
      headers: headers,
      body: request.body,
    });
    
    const response = new Response(targetResponse.body, targetResponse);

    response.headers.set("access-control-allow-origin", "*");
    response.headers.set("access-control-allow-methods", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS");
    response.headers.set("access-control-allow-headers", "*");

    return response;
  }
};