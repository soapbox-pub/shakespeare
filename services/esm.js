export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return Response.redirect("https://shakespeare.diy", 302);
    }

    url.hostname = "esm.sh";

    // Cache response via Cloudflare
    const response = await fetch(url, {
      cf: { cacheEverything: true }
    });

    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "public, max-age=86400, immutable");
    headers.set("Access-Control-Allow-Origin", "*");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
