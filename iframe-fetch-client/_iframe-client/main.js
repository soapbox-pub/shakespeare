/**
 * iframe Fetch Client Combined Entry Point
 * Combines console interception and client initialization
 */

// Console interception utilities
const CONSOLE_METHODS = ['log', 'warn', 'error', 'info', 'debug'];

// Store original console methods
function storeOriginalConsole() {
  const original = {};
  CONSOLE_METHODS.forEach(method => {
    if (typeof console[method] === 'function') {
      original[method] = console[method];
    }
  });
  return original;
}

// Override console methods with custom handler
function overrideConsoleMethods(originalConsole, messageHandler) {
  CONSOLE_METHODS.forEach(method => {
    if (typeof console[method] === 'function') {
      console[method] = (...args) => {
        // Call original method first
        try {
          originalConsole[method](...args);
        } catch (e) {
          // If original fails, at least send to parent
          messageHandler(method, ...args);
          return;
        }

        // Send to parent
        messageHandler(method, ...args);
      };
    }
  });
}

// Set up global error handlers
function setupGlobalErrorHandlers(messageHandler) {
  // Override window.onerror to catch unhandled errors
  const originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    // Call original handler first
    if (originalOnError) {
      originalOnError(message, source, lineno, colno, error);
    }

    // Send to parent
    messageHandler('error', `Uncaught Error: ${message}`, {
      source,
      lineno,
      colno,
      error: error ? error.message : 'No error object',
      stack: error ? error.stack : 'No stack trace'
    });

    return false; // Don't prevent default
  };

  // Override window.onunhandledrejection for Promise rejections
  const originalOnUnhandledRejection = window.onunhandledrejection;
  window.onunhandledrejection = (event) => {
    // Call original handler first
    if (originalOnUnhandledRejection) {
      originalOnUnhandledRejection(event);
    }

    // Send to parent
    messageHandler('error', 'Unhandled Promise Rejection', {
      reason: event.reason,
      promise: event.promise ? 'Promise object' : 'No promise object'
    });

    event.preventDefault(); // Prevent default console warning
  };
}

// Early Console Interception - runs immediately
class EarlyConsoleInterceptor {
  constructor() {
    this.originalConsole = {};
    this.earlyErrors = [];
    this.consoleMethods = CONSOLE_METHODS;

    this.init();
  }

  init() {
    this.storeOriginalConsole();
    this.overrideConsoleMethods();
    this.setupGlobalErrorHandlers();
    this.exposeToWindow();
  }

  storeOriginalConsole() {
    this.consoleMethods.forEach(method => {
      if (typeof console[method] === 'function') {
        this.originalConsole[method] = console[method];
      }
    });
  }

  overrideConsoleMethods() {
    this.consoleMethods.forEach(method => {
      if (typeof console[method] === 'function') {
        console[method] = (...args) => {
          this.handleConsoleCall(method, args);
        };
      }
    });
  }

  handleConsoleCall(method, args) {
    // Try to call the original method
    try {
      this.originalConsole[method](...args);
    } catch (e) {
      // Original method failed, continue
    }

    // Store error for later processing
    if (method === 'error' || method === 'exception') {
      this.earlyErrors.push({
        level: method,
        message: this.serializeArgs(args)
      });
    }
  }

  serializeArgs(args) {
    return args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
  }

  setupGlobalErrorHandlers() {
    // Handle window errors
    window.addEventListener('error', (event) => {
      this.earlyErrors.push({
        level: 'error',
        message: `Global Error: ${event.message} (${event.filename}:${event.lineno}:${event.colno})`
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.earlyErrors.push({
        level: 'error',
        message: `Unhandled Promise Rejection: ${event.reason}`
      });
    });
  }

  exposeToWindow() {
    // Store early errors for the main script to process
    window._earlyConsoleErrors = this.earlyErrors;

    // Store original console reference for the main script
    window._originalConsole = this.originalConsole;
  }
}

// Console Interceptor - handles ongoing console interception
class ConsoleInterceptor {
  constructor() {
    // Use the original console stored by the early interceptor
    this.originalConsole = window._originalConsole || console;
    overrideConsoleMethods(this.originalConsole, this.sendConsoleMessage.bind(this));
    setupGlobalErrorHandlers(this.sendConsoleMessage.bind(this));
    this.overrideWindowError();
  }

  overrideWindowError() {
    // Also try to catch errors that might occur during early execution
    setTimeout(() => {
      // Capture any errors that might have occurred before we were ready
      this.sendConsoleMessage('info', 'Console interceptor initialized at:', Date.now());
    }, 0);
  }

  sendConsoleMessage(level, ...args) {
    try {
      const message = args.map(arg => {
        if (arg === undefined) return 'undefined';
        if (arg === null) return 'null';
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, (key, value) => {
              if (value instanceof Error) {
                return {
                  name: value.name,
                  message: value.message,
                  stack: value.stack
                };
              }
              return value;
            });
          } catch {
            return String(arg);
          }
        }
        if (typeof arg === 'function') {
          return arg.toString();
        }
        return String(arg);
      }).join(' ');

      // Try to send to parent, but don't fail if parent isn't ready
      try {
        window.parent.postMessage({
          jsonrpc: "2.0",
          method: "console",
          params: {
            level,
            message
          }
        }, "*");
      } catch (postMessageError) {
        // Parent might not be ready yet, try again later
        setTimeout(() => {
          try {
            window.parent.postMessage({
              jsonrpc: "2.0",
              method: "console",
              params: {
                level: "error",
                message: `[DELAYED] ${message}`
              }
            }, "*");
          } catch {
            // Give up - parent isn't available
          }
        }, 100);
      }
    } catch (error) {
      // If serialization fails, at least try to send a simple message
      try {
        window.parent.postMessage({
          jsonrpc: "2.0",
          method: "console",
          params: {
            level: "error",
            message: `Console interceptor error: ${error.message}`
          }
        }, "*");
      } catch {
        // If even this fails, we can't do anything
      }
    }
  }
}

// JSON-RPC Client for communication with parent
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

// Main Fetch Client
class FetchClient {
  constructor() {
    this.rpcClient = new JSONRPCClient();
    this.swReady = false;
    this.consoleInterceptor = new ConsoleInterceptor();

    // Process any early errors captured by inline script
    this.processEarlyErrors();

    this.init();
  }

  processEarlyErrors() {
    // Check for early errors captured before main script loaded
    if (window._earlyConsoleErrors && Array.isArray(window._earlyConsoleErrors)) {
      window._earlyConsoleErrors.forEach(error => {
        console.log(`[EARLY ${error.level.toUpperCase()}] ${error.message}`);
      });
      // Clear the early errors
      window._earlyConsoleErrors = [];
    }
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

// Initialize early console interception immediately
new EarlyConsoleInterceptor();

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new FetchClient());
} else {
  new FetchClient();
}