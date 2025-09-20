# iframe Fetch Client Messaging Protocol (JSON-RPC)

This document describes the simplified JSON-RPC based communication protocol
between the parent page and the iframe fetch client.

## Overview

The iframe fetch client uses JSON-RPC 2.0 over `postMessage` for communication.
The ServiceWorker makes JSON-RPC calls directly, with the main thread acting as
a relay between the ServiceWorker and parent page.

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

// POST Request with JSON body
{
    "jsonrpc": "2.0",
    "method": "fetch",
    "params": {
        "request": {
            "url": "https://app123.example.com/api/data",
            "method": "POST",
            "headers": {
                "Content-Type": "application/json"
            },
            "body": "eyJuYW1lIjoiSm9obiIsImFnZSI6MzB9"  // base64 of: {"name":"John","age":30}
        }
    },
    "id": 124
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
        "body": "Y29uc29sZS5sb2coJ2hlbGxvJyk7"
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
  - `body` (string|null): Request body as base64 encoded string, or null if no body

**Result:**

- `status` (number): HTTP status code (200, 404, etc.)
- `statusText` (string): HTTP status text ("OK", "Not Found", etc.)
- `headers` (object): Response headers as key-value pairs
- `body` (string|null): Response body content as base64 encoded string (null if status is 204)

**Error Codes:**

- `-32001`: Invalid request format
- `-32002`: Request processing error
- `-32003`: Invalid URL

### `console`

**Purpose:** Forward console messages from iframe to parent for display

**Parameters:**

- `level` (string): Log level - "log", "warn", "error", "info", "debug"
- `message` (string): The log message

**Result:** None (notification only, no response expected)

## Implementation

### Parent Page

In this example, the parent page acts as a static file server.

```javascript
class FetchClientParent {
  constructor(files) {
    this.files = files; // Map of path -> {content, contentType}
    this.consoleLogs = []; // Store console messages
    this.setupMessageListener();
  }

  setupMessageListener() {
    window.addEventListener("message", (event) => {
      // Verify origin for security
      if (event.origin !== "https://app123.example.com") return;

      const message = event.data;

      // Handle fetch requests
      if (message.jsonrpc === "2.0" && message.method === "fetch") {
        this.handleFetch(message);
      }

      // Handle console messages
      if (message.jsonrpc === "2.0" && message.method === "console") {
        this.handleConsoleMessage(message);
      }
    });
  }

  handleConsoleMessage(message) {
    const { params } = message;
    const { level, message: logMessage } = params;

    // Store the log message
    this.consoleLogs.push({
      level,
      message: logMessage,
      timestamp: Date.now(), // Parent adds timestamp when received
      id: Date.now() // Unique ID for UI purposes
    });

    // Update UI to show new logs
    this.updateConsoleUI();

    // Also log to parent's console for debugging
    console[level](`[IFRAME] ${logMessage}`);
  }

  updateConsoleUI() {
    // This would update the parent page UI to show console logs
    // Implementation depends on your UI framework
    console.log(`Total console logs: ${this.consoleLogs.length}`);
  }

  handleFetch(request) {
    const { params, id } = request;
    const { request: fetchRequest } = params;

    // Extract path from URL
    const url = new URL(fetchRequest.url);
    const path = url.pathname;

    // Decode request body if present
    const requestBody = fetchRequest.body ? atob(fetchRequest.body) : null;

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
          body: btoa(file.content), // base64 encode the response body
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
          body: btoa(`File not found: ${path}`), // base64 encode the error message
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

## Base64 Encoding

All request and response bodies must be base64 encoded when not null. This ensures:

- **Consistent Data Handling:** Both text and binary data are handled uniformly
- **JSON Compatibility:** Avoids issues with special characters in JSON messages
- **Binary Data Support:** Enables transmission of images, files, and other binary content

**Encoding/Decoding:**
```javascript
// Encoding (before sending)
const encodedBody = btoa(originalBody);

// Decoding (after receiving)
const decodedBody = atob(encodedBody);
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

  // Example static file server with console logging
  class FetchClientParent {
    constructor(files) {
      this.files = files; // Map of path -> {content, contentType}
      this.consoleLogs = []; // Store console messages
      this.setupMessageListener();
    }

    setupMessageListener() {
      window.addEventListener("message", (event) => {
        // Verify origin for security
        if (event.origin !== "https://app123.example.com") return;

        const message = event.data;

        // Handle fetch requests
        if (message.jsonrpc === "2.0" && message.method === "fetch") {
          this.handleFetch(message);
        }

        // Handle console messages
        if (message.jsonrpc === "2.0" && message.method === "console") {
          this.handleConsoleMessage(message);
        }
      });
    }

    handleConsoleMessage(message) {
      const { params } = message;
      const { level, message: logMessage } = params;

      // Store the log message
      this.consoleLogs.push({
        level,
        message: logMessage,
        timestamp: Date.now(), // Parent adds timestamp when received
        id: Date.now() // Unique ID for UI purposes
      });

      // Update UI to show new logs
      this.updateConsoleUI();

      // Also log to parent's console for debugging
      console[level](`[IFRAME] ${logMessage}`);
    }

    updateConsoleUI() {
      // This would update the parent page UI to show console logs
      // Implementation depends on your UI framework
      console.log(`Total console logs: ${this.consoleLogs.length}`);
    }

    handleFetch(request) {
      const { params, id } = request;
      const { request: fetchRequest } = params;

      // Extract path from URL
      const url = new URL(fetchRequest.url);
      const path = url.pathname;

      // Decode request body if present
      const requestBody = fetchRequest.body ? atob(fetchRequest.body) : null;

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
            body: btoa(file.content), // base64 encode the response body
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
            body: btoa(`File not found: ${path}`), // base64 encode the error message
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

  // Example static file server
  new FetchClientParent(files);
</script>
```

## Console Logging Implementation

To enable console logging from the iframe to the parent page, the iframe's bootstrap script should override the console methods:

```javascript
// In the iframe's bootstrap script
class ConsoleInterceptor {
  constructor() {
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug
    };

    this.overrideConsoleMethods();
  }

  overrideConsoleMethods() {
    const methods = ['log', 'warn', 'error', 'info', 'debug'];

    methods.forEach(method => {
      console[method] = (...args) => {
        // Call original method first
        this.originalConsole[method](...args);

        // Send to parent via JSON-RPC
        this.sendConsoleMessage(method, ...args);
      };
    });
  }

  sendConsoleMessage(level, ...args) {
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    window.parent.postMessage({
      jsonrpc: "2.0",
      method: "console",
      params: {
        level,
        message
      }
    }, "*");
  }
}

// Initialize console interception
new ConsoleInterceptor();
```