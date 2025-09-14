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

    // Serialize the fetch request
    let body = null;
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

    const serializedRequest = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
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
        reject(new Error(`Timeout requesting: ${request.url}`));
      }
    }, 10000);
  });
}

// Fetch event - intercept all requests
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Ignore requests to other origins
  if (url.origin !== location.origin) {
    return;
  }

  // Let iframe client system files be handled normally
  if (url.pathname.startsWith("/_") || url.pathname === "/sw.js") {
    return;
  }

  // Let root path be handled normally (loads the iframe client page)
  if (url.pathname === "/") {
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
