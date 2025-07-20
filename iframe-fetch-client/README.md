# iframe Fetch Client

An iframe preview system for **Single Page Applications (SPAs)**.

## Why?

We want to display a preview of a project built with Vite, Webpack, etc in an
iframe, but the SPA uses root-relative paths (like `/assets/main.js`). This
means we can't just load it directly from a file system or a local server
without deploying it to a web server.

To work around this, we can instead deploy this "iframe Fetch Client" to a
subdomain, embed it in an iframe, and then respond to its `postMessage` requests
from the parent to serve it the files it needs.

This "iframe Fetch Client" is entirely static files, and only needs to be
deployed once. As long as the parent page implements its JSON-RPC protocol, it
can serve any web application.

## Architecture

```
┌─────────────────┐   JSON-RPC over     ┌──────────────────────┐
│   Parent Page   │   postMessage       │    iframe Client     │
│  (example.com)  │ ←─────────────────→ │   (*.example.com)    │
│                 │   fetch()           │                      │
│ - Request       │                     │ ┌──────────────────┐ │
│   handling      │                     │ │  Main Thread     │ │
└─────────────────┘                     │ │  (relay only)    │ │
                                        │ │        ↕         │ │
                                        │ │  JSON-RPC over   │ │
                                        │ │  postMessage     │ │
                                        │ │        ↕         │ │
                                        │ │ ┌──────────────┐ │ │
                                        │ │ │ServiceWorker │ │ │
                                        │ │ │              │ │ │
                                        │ │ │- Makes       │ │ │
                                        │ │ │  JSON-RPC    │ │ │
                                        │ │ │  calls       │ │ │
                                        │ │ │- Handles     │ │ │
                                        │ │ │  requests    │ │ │
                                        │ │ └──────────────┘ │ │
                                        │ └──────────────────┘ │
                                        └──────────────────────┘
```

## Limitations

This system uses a ServiceWorker to serve requests, which means the preview site
cannot itself register a ServiceWorker. If it tries, the attempt will be
blocked.

## Files Structure

```
/
├── index.html              # Main iframe client page
├── _iframe-client.js       # Main coordination script
├── _iframe-client.css      # Styles for the iframe client
├── sw.js                   # ServiceWorker
├── MESSAGING_PROTOCOL.md   # Communication protocol docs
├── example-parent.html     # Example parent implementation
└── README.md               # This file
```

## Simplified JSON-RPC Protocol

The system now uses a drastically simplified JSON-RPC 2.0 protocol with only one
method:

- **`fetch(request)`** - Handle HTTP requests with serialized fetch
  request/response

**Request:**

```javascript
{
    "jsonrpc": "2.0",
    "method": "fetch", 
    "params": { 
        "request": {
            "url": "https://app123.example.com/assets/main.js",
            "method": "GET",
            "headers": {},
            "body": null
        }
    },
    "id": 123
}
```

**Response:**

```javascript
{
    "jsonrpc": "2.0",
    "result": {
        "status": 200,
        "statusText": "OK",
        "headers": {
            "Content-Type": "application/javascript"
        },
        "body": "console.log('hello');"
    },
    "id": 123
}
```

## How It Works

1. **Initialization:**
   - iframe client loads at `app123.example.com`
   - Registers ServiceWorker at `/sw.js` with scope `/`
   - Blocks future ServiceWorker registrations
   - Main thread sets up relay between ServiceWorker and parent

2. **Request Handling:**
   - ServiceWorker intercepts all requests (except iframe client system files)
   - ServiceWorker makes JSON-RPC `fetch()` calls directly with serialized
     requests
   - Main thread relays JSON-RPC messages between ServiceWorker and parent
   - Parent responds with serialized HTTP responses
   - ServiceWorker creates Response objects and returns them to the client app

3. **Content Replacement:**
   - Main thread requests `/` from parent via JSON-RPC fetch
   - Replaces its own content with the site index
   - Site runs normally, with all requests handled by SW via JSON-RPC

## Deployment

### iframe Client Domain (`*.example.com`)

Deploy these files to your iframe client subdomain:

```
https://*.example.com/
├── index.html
├── _iframe-client.js
├── _iframe-client.css
└── sw.js
```

**Security Note:** It is recommended to serve the client on a wildcard subdomain
(like `*.example.com`) if you wish to support multiple projects. That way
projects won't share the same localStorage and IndexedDB.

### Parent Page Integration

Include the iframe client in your parent page:

```html
<iframe
  id="preview-iframe"
  src="https://app123.example.com/"
  sandbox="allow-scripts allow-same-origin"
>
</iframe>
```

Implement the JSON-RPC protocol (see `example-parent.html` for a complete
example):

```javascript
class FetchClientParent {
  constructor(files) {
    this.files = files; // Map of path -> {content, contentType}
    this.setupMessageListener();
  }

  setupMessageListener() {
    window.addEventListener("message", (event) => {
      if (event.origin !== "https://example.com") return;

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
      // Return 404 response
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
}
```

## Request Handling

Handle requests by providing responses as a Map or object for static files, or
implement custom logic for dynamic requests:

```javascript
const staticFiles = new Map([
  ["/", {
    content: "<!DOCTYPE html>...",
    contentType: "text/html",
  }],
  ["/assets/main.js", {
    content: 'console.log("app");',
    contentType: "application/javascript",
  }],
  ["/assets/style.css", {
    content: "body { margin: 0; }",
    contentType: "text/css",
  }],
]);

// Or handle dynamic requests like APIs
function handleRequest(fetchRequest) {
  const url = new URL(fetchRequest.url);

  if (url.pathname.startsWith("/api/")) {
    // Handle API requests
    return handleAPIRequest(fetchRequest);
  } else {
    // Serve static files
    return serveStaticFile(url.pathname);
  }
}
```

## Security Features

- **Origin Validation:** Messages are validated by origin
- **Sandboxed Iframe:** Client runs in a sandboxed environment
- **Isolated ServiceWorker:** SW only affects the iframe client domain
- **No Direct Access:** Parent controls all request handling

## Testing

1. Open `example-parent.html` in a browser
2. Click "Load Sample Site"
3. The iframe client should load and display the sample app
4. Test navigation and functionality within the iframe client

## Browser Support

- **ServiceWorker:** Required (supported in all modern browsers)
- **postMessage:** Required (universal support)
- **iframe sandbox:** Recommended (modern browsers)

## Limitations

- Request/response bodies must be JSON-serializable strings (no binary support)
- All requests go through the parent page (potential performance impact)
- Requires HTTPS for ServiceWorker (except localhost)
- Limited to same-origin communication patterns within the iframe

## Troubleshooting

### iframe client doesn't load

- Check browser console for ServiceWorker errors
- Verify HTTPS is used (required for ServiceWorker)
- Ensure parent page implements the messaging protocol

### Requests fail

- Check that request paths match your handling logic (case-sensitive)
- Verify parent page is responding to JSON-RPC `fetch` requests
- Check browser network tab for failed requests

### Communication issues

- Verify iframe src points to correct preview domain
- Check that JSON-RPC messages are properly formatted
- Ensure iframe has appropriate sandbox permissions

## Development

To modify the system:

1. **iframe Client:** Edit `index.html`, `_iframe-client.js`,
   `_iframe-client.css`, `sw.js`
2. **Protocol:** Update `MESSAGING_PROTOCOL.md` for any changes
3. **Testing:** Use `example-parent.html` for testing changes

## License

This system is designed for development and testing purposes. Ensure appropriate
security measures for production use.
