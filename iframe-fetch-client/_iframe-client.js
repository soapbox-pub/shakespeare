/**
 * iframe Fetch Client Main Script
 * JSON-RPC based communication with parent page
 */

class JSONRPCClient {
  constructor() {
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.setupMessageListener();
  }

  setupMessageListener() {
    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message.jsonrpc === "2.0" && message.id !== undefined) {
        // Check if this is a response to our own request or a ServiceWorker request
        if (this.pendingRequests.has(message.id)) {
          this.handleResponse(message);
        } else {
          // This is a response to a ServiceWorker request, relay it back
          this.relayJSONRPCToServiceWorker(message);
        }
      }
    });
  }

  relayJSONRPCToServiceWorker(response) {
    // Forward the JSON-RPC response to ServiceWorker
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(response);
    }
  }

  async fetch(request) {
    const id = ++this.requestId;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      // Send JSON-RPC request to parent
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
      pending.reject(new Error(`${error.message} (code: ${error.code})`));
    } else {
      pending.resolve(result);
    }
  }
}

class FetchClient {
  constructor() {
    this.rpcClient = new JSONRPCClient();
    this.swReady = false;

    this.init();
  }

  async init() {
    try {
      await this.registerServiceWorker();
      this.setupServiceWorkerCommunication();
      await this.waitForServiceWorker();
      await this.fetchSiteIndex();
    } catch (error) {
      this.showError("Failed to initialize fetch client", error);
    }
  }

  async registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      throw new Error("ServiceWorker not supported");
    }

    // Check if SW is already registered
    const existingRegistration = await navigator.serviceWorker
      .getRegistration();
    if (existingRegistration) {
      console.log("ServiceWorker already registered");
      this.swReady = true;
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });

      console.log("ServiceWorker registered:", registration);

      // Wait for SW to be ready
      await navigator.serviceWorker.ready;
      this.swReady = true;

      // Block future registrations to prevent site from registering its own SW
      this.blockFutureRegistrations();
    } catch (error) {
      throw new Error(`ServiceWorker registration failed: ${error.message}`);
    }
  }

  blockFutureRegistrations() {
    navigator.serviceWorker.register = function () {
      console.log("Blocked ServiceWorker registration attempt");
      return Promise.resolve({
        scope: "/",
        active: navigator.serviceWorker.controller,
        installing: null,
        waiting: null,
        addEventListener: () => {},
        removeEventListener: () => {},
      });
    };
  }

  setupServiceWorkerCommunication() {
    // Listen for JSON-RPC requests from ServiceWorker and relay them to parent
    navigator.serviceWorker.addEventListener("message", async (event) => {
      const { data } = event;

      // Check if this is a JSON-RPC request from ServiceWorker
      if (data.jsonrpc === "2.0" && data.method && data.id !== undefined) {
        this.relayJSONRPCToParent(data);
      }
    });
  }

  relayJSONRPCToParent(request) {
    // Forward the JSON-RPC request directly to parent
    window.parent.postMessage(request, "*");
  }

  async waitForServiceWorker() {
    const timeout = 10000; // 10 seconds
    const start = Date.now();

    while (!this.swReady) {
      if (Date.now() - start > timeout) {
        throw new Error("Timeout waiting for ServiceWorker readiness");
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log("ServiceWorker is ready");
  }

  async fetchSiteIndex() {
    try {
      // Request site index from parent via JSON-RPC fetch
      const serializedRequest = {
        url: `${location.origin}/`,
        method: "GET",
        body: null,
        headers: {},
      };

      const response = await this.rpcClient.fetch(serializedRequest);

      if (response.status !== 200) {
        throw new Error(`Failed to fetch site index: ${response.status} ${response.statusText}`);
      }
      if (response.headers["Content-Type"] !== "text/html") {
        throw new Error(`Unexpected Content-Type: ${response.headers["Content-Type"]}`);
      }

      const bytes = new Uint8Array(atob(response.body).split('').map(c => c.charCodeAt(0)));
      const text = new TextDecoder().decode(bytes);

      // Replace current document with the site index content
      this.replaceDocument(text);
    } catch (error) {
      this.showError("Failed to load site index", error);
    }
  }

  replaceDocument(htmlContent) {
    // Create a new document from the HTML content
    const parser = new DOMParser();
    const newDoc = parser.parseFromString(htmlContent, "text/html");

    const scripts = [];
    newDoc.querySelectorAll("script").forEach((script) => {
      scripts.push({
        src: script.src,
        type: script.type,
        async: script.hasAttribute("async"),
        defer: script.hasAttribute("defer"),
      });
      script.parentNode.removeChild(script);
    });

    // Replace the entire document
    document.head.innerHTML = newDoc.head.innerHTML;
    document.body.innerHTML = newDoc.body.innerHTML;

    // Re-add scripts (this is necessary to execute them)
    scripts.forEach((script) => {
      const newScript = document.createElement("script");
      newScript.src = script.src;
      newScript.type = script.type;
      if (script.async) newScript.async = true;
      if (script.defer) newScript.defer = true;
      document.body.appendChild(newScript);
    });

    console.log("Document replaced with site content");
  }

  showError(message, error) {
    console.error(message, error);

    document.body.innerHTML = `
            <div style="
                font-family: system-ui, -apple-system, sans-serif;
                max-width: 600px;
                margin: 50px auto;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 8px;
                border-left: 4px solid #dc3545;
            ">
                <h2 style="color: #dc3545; margin-top: 0;">Fetch Client Error</h2>
                <p><strong>${message}</strong></p>
                <p style="color: #6c757d;">${error.message || error}</p>
                <details style="margin-top: 20px;">
                    <summary style="cursor: pointer; color: #007bff;">Technical Details</summary>
                    <pre style="
                        background: #f1f3f4;
                        padding: 10px;
                        border-radius: 4px;
                        overflow-x: auto;
                        font-size: 12px;
                        margin-top: 10px;
                    ">${error.stack || JSON.stringify(error, null, 2)}</pre>
                </details>
            </div>
        `;
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new FetchClient());
} else {
  new FetchClient();
}
