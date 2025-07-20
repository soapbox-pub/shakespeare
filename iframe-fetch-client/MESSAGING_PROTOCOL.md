# iframe Fetch Client Messaging Protocol (JSON-RPC)

This document describes the simplified JSON-RPC based communication protocol
between the parent page and the iframe fetch client.

## Overview

The iframe fetch client uses JSON-RPC 2.0 over `postMessage` for communication.
The ServiceWorker makes JSON-RPC calls directly, with the main thread acting as
a relay between the ServiceWorker and parent page. The only required method is
`fetch` for handling HTTP requests.

## Architecture

```
┌─────────────────┐   JSON-RPC over     ┌──────────────────────┐
│   Parent Page   │   postMessage       │      Main Thread     │
│                 │ ←─────────────────→ │     (relay only)     │
│ - Request       │                     │                      │
│   handling      │                     │           ↕          │
└─────────────────┘                     │     JSON-RPC over    │
                                        │      postMessage     │
                                        │                      │
                                        │ ┌──────────────────┐ │
                                        │ │  ServiceWorker   │ │
                                        │ │                  │ │
                                        │ │ - Makes JSON-RPC │ │
                                        │ │   calls directly │ │
                                        │ │ - Handles        │ │
                                        │ │   requests       │ │
                                        │ └──────────────────┘ │
                                        └──────────────────────┘
```

## JSON-RPC Structure

All messages follow JSON-RPC 2.0 specification:

```javascript
// GET Request
{
    "jsonrpc": "2.0",
    "method": "fetch",
    "params": { 
        "request": {
            "url": "https://app123.example.com/assets/main.js",
            "method": "GET",
            "headers": {
                "Accept": "application/javascript"
            },
            "body": null
        }
    },
    "id": 123
}

// Success Response
{
    "jsonrpc": "2.0",
    "result": {
        "status": 200,
        "statusText": "OK",
        "headers": {
            "Content-Type": "application/javascript",
            "Cache-Control": "no-cache"
        },
        "body": "console.log('hello');"
    },
    "id": 123
}

// Error Response (still uses JSON-RPC error format for protocol errors)
{
    "jsonrpc": "2.0",
    "error": {
        "code": -32001,
        "message": "Invalid request format",
        "data": { "url": "/assets/main.js" }
    },
    "id": 123
}
```

## Methods

### `fetch`

**Purpose:** Handle HTTP requests, including GET, POST, PUT, DELETE, etc. with
full request body support

**Parameters:**

- `request` (object): Serialized fetch request
  - `url` (string): Full URL of the request
  - `method` (string): HTTP method (GET, POST, etc.)
  - `headers` (object): Request headers as key-value pairs
  - `body` (string|null): Request body as string, or null if no body

**Result:**

- `status` (number): HTTP status code (200, 404, etc.)
- `statusText` (string): HTTP status text ("OK", "Not Found", etc.)
- `headers` (object): Response headers as key-value pairs
- `body` (string|null): Response body content (null if status is 204)

**Error Codes:**

- `-32001`: Invalid request format
- `-32002`: Request processing error
- `-32003`: Invalid URL

**Request Body Support:** The system fully supports request bodies, enabling:

- POST/PUT requests with JSON data
- Form submissions
- API calls with payloads
- File uploads (as base64 strings)
- Any HTTP method with body content

Request bodies are serialized as strings, so binary data should be
base64-encoded.

## Implementation

### Parent Page

In this example, the parent page acts as a static file server.

```javascript
class FetchClientParent {
  constructor(files) {
    this.files = files; // Map of path -> {content, contentType}
    this.setupMessageListener();
  }

  setupMessageListener() {
    window.addEventListener("message", (event) => {
      // Verify origin for security
      if (event.origin !== "https://app123.example.com") return;

      const message = event.data;
      if (message.jsonrpc === "2.0" && message.method === "fetch") {
        this.handleFetch(message);
      }
    });
  }

  handleFetch(request) {
    const { params, id } = request;
    const { request: fetchRequest } = params;

    // Extract path from URL
    const url = new URL(fetchRequest.url);
    const path = url.pathname;

    const file = this.files.get(path);

    if (file) {
      this.sendResponse({
        id,
        jsonrpc: "2.0",
        result: {
          status: 200,
          statusText: "OK",
          headers: {
            "Content-Type": file.contentType,
            "Cache-Control": "no-cache",
          },
          body: file.content,
        },
      });
    } else {
      // Return 404 response (not a JSON-RPC error)
      this.sendResponse({
        id,
        jsonrpc: "2.0",
        result: {
          status: 404,
          statusText: "Not Found",
          headers: {
            "Content-Type": "text/plain",
          },
          body: `File not found: ${path}`,
        },
      });
    }
  }

  sendResponse(message) {
    const iframe = document.getElementById("preview-iframe");
    iframe.contentWindow.postMessage(message, "https://app123.example.com");
  }

  sendError(message) {
    const iframe = document.getElementById("preview-iframe");
    iframe.contentWindow.postMessage(message, "https://app123.example.com");
  }
}
```

### Preview Page

Below is a simplified RPC client that could be used inside the iframe's main
thread to test functionality of the parent. In practice, requests originate from
the ServiceWorker and the main thread acts as a relay, so multiple steps of
communication are involved.

```javascript
class JSONRPCClient {
  constructor() {
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.setupMessageListener();
  }

  setupMessageListener() {
    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message.jsonrpc === "2.0" && message.id) {
        this.handleResponse(message);
      }
    });
  }

  async fetch(request) {
    const id = ++this.requestId;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      // Send request to parent
      window.parent.postMessage({
        jsonrpc: "2.0",
        method: "fetch",
        params: { request },
        id,
      }, "*");

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Timeout fetching: ${request.url}`));
        }
      }, 10000);
    });
  }

  handleResponse(message) {
    const { id, result, error } = message;
    const pending = this.pendingRequests.get(id);

    if (!pending) return;

    this.pendingRequests.delete(id);

    if (error) {
      pending.reject(new Error(error.message));
    } else {
      // Result is a serialized response
      pending.resolve(result);
    }
  }
}
```

## Security

- **Origin Validation:** Always verify message origin
- **Path Validation:** Validate file paths to prevent directory traversal
- **Timeout:** Requests timeout after 10 seconds
- **Error Handling:** Proper JSON-RPC error responses

## Example Usage

```html
<iframe
  id="preview-iframe"
  src="https://app123.example.com"
  sandbox="allow-scripts allow-same-origin"
>
</iframe>

<script>
  const files = new Map([
    ["/", {
      content: "<!DOCTYPE html><html><body>Hello world!</body></html>",
      contentType: "text/html",
    }],
  ]);

  // Example static file server
  new FetchClientParent(files);
</script>
```
