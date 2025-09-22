export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const target = url.searchParams.get("url");

    if (!target) {
      return new Response("Include a `url` query parameter", { status: 400 });
    }

    const headers = new Headers(request.headers);
    headers.set('User-Agent', 'Shakespeare Proxy <https://proxy.shakespeare.diy/>');

    const targetResponse = await fetch(target, request);
    const response = new Response(targetResponse.body, targetResponse);

    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");

    return response;
  }
};
