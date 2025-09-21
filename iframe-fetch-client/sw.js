/**
 * iframe Fetch Client ServiceWorker
 * Intercepts requests and handles them via JSON-RPC communication
 */

let pendingRequests = new Map();
let requestIdCounter = 0;

// Install event
self.addEventListener("install", (event) => {
  console.log("ServiceWorker installing");
  self.skipWaiting();
});

// Activate event
self.addEventListener("activate", (event) => {
  console.log("ServiceWorker activating");
  event.waitUntil(self.clients.claim());
});

// Message handling from main thread (JSON-RPC responses)
self.addEventListener("message", (event) => {
  handleMainThreadMessage(event.data);
});

function handleMainThreadMessage(data) {
  // Handle JSON-RPC responses relayed from main thread
  if (data.jsonrpc === "2.0" && data.id !== undefined) {
    handleJSONRPCResponse(data);
  }
}

function handleJSONRPCResponse(message) {
  const { id, result, error } = message;
  const pendingRequest = pendingRequests.get(id);

  if (!pendingRequest) {
    console.warn("No pending request found for ID:", id);
    return;
  }

  pendingRequests.delete(id);

  if (error) {
    pendingRequest.reject(new Error(`${error.message} (code: ${error.code})`));
    return;
  }

  // Create response from serialized response
  const { status, statusText, headers, body } = result;

  // Decode base64 body if present
  let decoded = null;
  if (typeof body === "string") {
    decoded = new Uint8Array(atob(body).split('').map(c => c.charCodeAt(0)));
  }

  const response = new Response(decoded, {
    status: status || 200,
    statusText: statusText || "OK",
    headers: headers || {},
  });

  pendingRequest.resolve(response);
}

async function requestViaJSONRPC(request) {
  return new Promise(async (resolve, reject) => {
    const id = ++requestIdCounter;

    // Check if request is a plain object or Request object
    let url, method, headers, body;

    if (request instanceof Request) {
      // Handle Request object
      url = request.url;
      method = request.method;
      headers = Object.fromEntries(request.headers.entries());

      if (request.body) {
        try {
          // Convert body to Uint8Array then base64 encode
          const bytes = await request.bytes();
          body = btoa(String.fromCharCode(...bytes));
        } catch (error) {
          reject(new Error(`Failed to serialize request body: ${error.message}`));
          return;
        }
      }
    } else {
      // Handle plain request object
      url = request.url;
      method = request.method || 'GET';
      headers = request.headers || {};
      body = request.body || null;
    }

    const serializedRequest = {
      url: url,
      method: method,
      headers: headers,
      body: body,
    };

    pendingRequests.set(id, { resolve, reject, originalRequest: request });

    // Send JSON-RPC request to main thread for relay to parent
    self.clients.matchAll().then((clients) => {
      if (clients.length > 0) {
        clients[0].postMessage({
          jsonrpc: "2.0",
          method: "fetch",
          params: { request: serializedRequest },
          id,
        });
      } else {
        pendingRequests.delete(id);
        reject(new Error("No clients available"));
      }
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`Timeout requesting: ${url}`));
      }
    }, 10000);
  });
}

// Fetch event - intercept all requests
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Debug logging for fetch interception
  console.log("ServiceWorker fetch:", url.pathname);

  // Ignore requests to other origins
  if (url.origin !== location.origin) {
    console.log("Ignoring different origin:", url.origin);
    return;
  }

  // Let iframe client system files be handled normally
  if (url.pathname.startsWith("/_") || url.pathname === "/sw.js") {
    console.log("Serving iframe client system file:", url.pathname);
    return;
  }

  // Let root path be handled normally (loads the iframe client page)
  if (url.pathname === "/") {
    console.log("Serving root path (iframe client)");
    return;
  }

  // Let iframe client assets be handled normally (anything in _iframe-client directory and common assets)
  if (url.pathname.startsWith("/_iframe-client/") ||
      url.pathname === "/favicon.ico" ||
      url.pathname === "/manifest.webmanifest") {
    console.log("Serving iframe client asset:", url.pathname);
    return;
  }

  console.log("Intercepting request for project:", url.pathname);

  // For SPA routes, check if this is a navigation request (HTML page request)
  // But first check if we need to load the iframe client (this happens during refresh)
  if (event.request.mode === "navigate" &&
      (event.request.headers.get("accept") || "").includes("text/html")) {

    // Check if this is a request for the iframe client itself
    // We need to serve the iframe client HTML first, which will then load the SPA
    if (url.pathname !== "/") {
      console.log("Navigation request to non-root path, redirecting to iframe client first");

      // Redirect to root to load the iframe client, which will then navigate to the target path
      const response = Response.redirect(new URL("/", event.request.url).href, 302);
      event.respondWith(response);
      return;
    }

    // This is a request for the root path, serve the site's index.html via JSON-RPC
    const rootRequest = {
      url: new URL("/", event.request.url).href,
      method: event.request.method,
      headers: Object.fromEntries(event.request.headers.entries()),
      body: event.request.body
    };
    event.respondWith(handleRequest(rootRequest));
    return;
  }

  // Handle all other requests through JSON-RPC communication
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  try {
    console.log("ServiceWorker handling request for:", request.url);
    return await requestViaJSONRPC(request);
  } catch (error) {
    console.error("Failed to handle request:", request.url, error);

    // Return 404 for failed requests
    return new Response(`Request failed: ${request.url}`, {
      status: 404,
      statusText: "Not Found",
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }
}

console.log("ServiceWorker script loaded");
