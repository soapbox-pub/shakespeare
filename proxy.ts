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
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
          "Access-Control-Allow-Headers": "*", // Or specify specific headers
          "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
        }
      });
    }

    const headers = new Headers(request.headers);
    headers.set('User-Agent', 'Shakespeare Proxy <https://proxy.shakespeare.diy/>');

    const targetResponse = await fetch(target, {
      method: request.method,
      headers: headers,
      body: request.body,
    });
    
    const response = new Response(targetResponse.body, targetResponse);

    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "*");

    return response;
  }
};