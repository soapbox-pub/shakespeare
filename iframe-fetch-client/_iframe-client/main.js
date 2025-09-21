/**
 * iframe Fetch Client - Simplified Implementation
 * Implements JSON-RPC 2.0 messaging protocol per MESSAGING_PROTOCOL.md
 */

// JSON-RPC Client for communication with parent
class JSONRPCClient {
  constructor() {
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.setupMessageListener();
  }

  setupMessageListener() {
    window.addEventListener("message", (event) => {
      // Only accept messages from parent window for security
      if (event.source !== window.parent) {
        return;
      }

      const message = event.data;
      // Check if this is a response to our own request or a ServiceWorker request
      if (message.jsonrpc === "2.0" && message.id !== undefined) {
        if (this.pendingRequests.has(message.id)) {
          this.handleResponse(message);
        } else {
          // This is a response to a ServiceWorker request, relay it back
          this.relayToServiceWorker(message);
        }
      }
    });
  }

  relayToServiceWorker(response) {
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

// Console Interceptor - forwards console messages to parent
class ConsoleInterceptor {
  constructor() {
    this.originalConsole = {};
    this.methods = ['log', 'warn', 'error', 'info', 'debug'];
    this.init();
  }

  init() {
    // Store original methods and override in single pass
    this.methods.forEach((method) => {
      if (typeof console[method] === 'function') {
        this.originalConsole[method] = console[method];

        console[method] = (...args) => {
          // Call original method
          try {
            this.originalConsole[method](...args);
          } catch (e) {
            // Continue if original fails
          }

          // Send to parent
          this.sendConsoleMessage(method, ...args);
        };
      }
    });
  }

  sendConsoleMessage(level, ...args) {
    const message = args.map((arg) => {
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
      return String(arg);
    }).join(' ');

    try {
      window.parent.postMessage({
        jsonrpc: "2.0",
        method: "console",
        params: { level, message }
      }, "*");
    } catch (error) {
      // Retry once after delay if postMessage fails
      setTimeout(() => {
        try {
          window.parent.postMessage({
            jsonrpc: "2.0",
            method: "console",
            params: { level: "error", message: `[DELAYED] ${message}` }
          }, "*");
        } catch {
          // Give up if retry fails
        }
      }, 100);
    }
  }
}

// Navigation Handler - manages iframe navigation and history
class NavigationHandler {
  constructor() {
    this.historyIndex = 0; // Track current position in history
    this.historyLength = 1; // Track total history length

    // Check for initial path set by loadSiteIndex
    if (window.__IFRAME_INITIAL_PATH__) {
      this.currentSemanticPath = window.__IFRAME_INITIAL_PATH__;
      console.log('NavigationHandler initialized with path:', this.currentSemanticPath);
    } else {
      this.currentSemanticPath = '/'; // Default to root path
    }

    this.setupMessageListener();
    this.setupHistoryListeners();
    this.overrideHistoryMethods();
    this.updateNavigationState();
  }

  // Helper method to update semantic path and ensure it's properly tracked
  updateSemanticPath(path) {
    if (typeof path === 'string') {
      this.currentSemanticPath = path;
    } else {
      // Fallback to current location if path is invalid
      this.currentSemanticPath = window.location.pathname + window.location.search + window.location.hash;
    }
  }

  setupMessageListener() {
    window.addEventListener("message", (event) => {
      // Only accept messages from parent window for security
      if (event.source !== window.parent) {
        return;
      }

      const message = event.data;
      if (message.jsonrpc === "2.0") {
        switch (message.method) {
          case "navigate":
            this.handleNavigate(message.params.url);
            break;
          case "refresh":
            this.handleRefresh();
            break;
          case "goBack":
            this.handleGoBack();
            break;
          case "goForward":
            this.handleGoForward();
            break;
        }
      }
    });
  }

  setupHistoryListeners() {
    // Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', (event) => {
      // When user navigates (back or forward), we need to update our tracking
      // The state object can help us determine our position
      // Update current semantic path based on actual URL
      const newPath = window.location.pathname + window.location.search + window.location.hash;
      this.updateSemanticPath(newPath);
      this.updateNavigationState();
    });

    // Listen for hash changes
    window.addEventListener('hashchange', () => {
      const newPath = window.location.pathname + window.location.search + window.location.hash;
      this.updateSemanticPath(newPath);
      this.updateNavigationState();
    });
  }

  overrideHistoryMethods() {
    // Override history.pushState and history.replaceState to detect SPA navigation
    this.originalPushState = window.history.pushState;
    this.originalReplaceState = window.history.replaceState;

    window.history.pushState = (...args) => {
      const result = this.originalPushState.apply(window.history, args);

      // Extract semantic path from the URL argument or current location
      let semanticPath;
      if (args[2] && typeof args[2] === 'string') {
        // If URL is provided as third argument, use it
        try {
          const url = new URL(args[2], window.location.origin);
          semanticPath = url.pathname + url.search + url.hash;
        } catch {
          semanticPath = window.location.pathname + window.location.search + window.location.hash;
        }
      } else {
        // Otherwise use current location
        semanticPath = window.location.pathname + window.location.search + window.location.hash;
      }

      // pushState was called, update semantic path
      this.updateSemanticPath(semanticPath);
      this.updateNavigationState();
      return result;
    };

    window.history.replaceState = (...args) => {
      const result = this.originalReplaceState.apply(window.history, args);

      // Extract semantic path for replaceState as well
      let semanticPath;
      if (args[2] && typeof args[2] === 'string') {
        try {
          const url = new URL(args[2], window.location.origin);
          semanticPath = url.pathname + url.search + url.hash;
        } catch {
          semanticPath = window.location.pathname + window.location.search + window.location.hash;
        }
      } else {
        semanticPath = window.location.pathname + window.location.search + window.location.hash;
      }

      // replaceState was called, update semantic path
      this.updateSemanticPath(semanticPath);
      this.updateNavigationState();
      return result;
    };
  }

  handleNavigate(url) {
    try {
      // Validate URL - must be same origin
      const targetUrl = new URL(url, window.location.origin);
      if (targetUrl.origin !== window.location.origin) {
        console.error('Navigation to different origin not allowed:', url);
        return;
      }

      // Extract the semantic path (pathname + search + hash)
      const semanticPath = targetUrl.pathname + targetUrl.search + targetUrl.hash;

      // Update our tracked semantic path using helper
      this.updateSemanticPath(semanticPath);
      this.updateNavigationState();

      // Use browser's history.pushState to trigger SPA navigation
      // This is what most SPAs (React Router, Vue Router, etc.) listen for
      window.history.pushState({}, '', semanticPath);

      // Dispatch popstate event to trigger SPA router navigation
      // Many SPAs listen for popstate events to handle navigation
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));

    } catch (error) {
      console.error('Invalid navigation URL:', url, error);
    }
  }

  handleRefresh() {
    // Store current semantic path for reload
    const currentPath = this.currentSemanticPath || '/';

    // Save the current path to sessionStorage so it persists across reload
    try {
      sessionStorage.setItem('iframe_initial_path', currentPath);
    } catch (error) {
      console.warn('Failed to store initial path in sessionStorage:', error);
    }

    // Actually reload the iframe to get a fresh SPA instance
    // This will trigger loadSiteIndex again, which will read the stored path
    window.location.reload();
  }

  handleGoBack() {
    if (this.historyIndex > 0) {
      window.history.back();
    }
  }

  handleGoForward() {
    if (this.historyIndex < this.historyLength - 1) {
      window.history.forward();
    }
  }

  updateNavigationState() {
    // Use tracked semantic path instead of window.location
    // This allows iframe to stay on base URL while showing semantic paths
    let semanticPath = this.currentSemanticPath;

    // Fallback to current location if semantic path is not set
    if (!semanticPath || semanticPath === '') {
      semanticPath = window.location.pathname + window.location.search + window.location.hash;
      this.updateSemanticPath(semanticPath);
    }

    const state = {
      currentUrl: semanticPath,
      canGoBack: false, // Let parent handle history tracking
      canGoForward: false // Let parent handle history tracking
    };

    // Send navigation state to parent
    try {
      window.parent.postMessage({
        jsonrpc: "2.0",
        method: "updateNavigationState",
        params: state
      }, "*");
    } catch (error) {
      console.error('Failed to send navigation state:', error);
    }
  }
}

// Main Fetch Client
class FetchClient {
  constructor() {
    console.log("FetchClient: Initializing...");
    this.rpcClient = new JSONRPCClient();
    this.consoleInterceptor = new ConsoleInterceptor();
    this.navigationHandler = new NavigationHandler();
    this.init();
  }

  // Ensure SPA navigates to initial path after document is loaded
  ensureInitialNavigation() {
    console.log('ensureInitialNavigation: Starting...');

    // Wait for the SPA to initialize, then navigate to the initial path
    setTimeout(() => {
      // Check multiple sources for the initial path
      let initialPath = window.__IFRAME_INITIAL_PATH__;

      // Try sessionStorage backup
      if (!initialPath) {
        try {
          initialPath = sessionStorage.getItem('iframe_initial_path_backup');
          sessionStorage.removeItem('iframe_initial_path_backup');
          if (initialPath) {
            window.__IFRAME_INITIAL_PATH__ = initialPath;
            console.log('ensureInitialNavigation: Restored path from sessionStorage:', initialPath);
          }
        } catch (e) {
          console.warn('ensureInitialNavigation: Failed to read sessionStorage backup:', e);
        }
      }

      if (initialPath && initialPath !== '/') {
        const currentPath = window.location.pathname + window.location.search + window.location.hash;

        console.log('ensureInitialNavigation: Current path:', currentPath, 'Target path:', initialPath);

        // If we're not already at the initial path, navigate there
        if (currentPath !== initialPath) {
          console.log('ensureInitialNavigation: Navigating to initial path:', initialPath);

          // Use a small delay to ensure the SPA is fully initialized
          setTimeout(() => {
            console.log('ensureInitialNavigation: Executing navigation...');
            this.navigationHandler.handleNavigate(initialPath);
          }, 50);
        } else {
          console.log('ensureInitialNavigation: Already at target path, no navigation needed');
        }
      } else {
        console.log('ensureInitialNavigation: No initial path or path is root, skipping navigation');
      }
    }, 150); // Give SPA more time to initialize
  }

  async init() {
    try {
      console.log("FetchClient: Setting up ServiceWorker...");
      await this.setupServiceWorker();
      console.log("FetchClient: Loading site index...");
      await this.loadSiteIndex();
      console.log("FetchClient: Initialization complete");
    } catch (error) {
      console.error("FetchClient: Initialization failed:", error);
      this.showError("Failed to initialize fetch client", error);
    }
  }

  async setupServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      throw new Error("ServiceWorker not supported");
    }

    // Check if already registered
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) {
      console.log("ServiceWorker already registered");
      this.setupServiceWorkerCommunication();
      return;
    }

    // Register new ServiceWorker
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    console.log("ServiceWorker registered:", registration);

    await navigator.serviceWorker.ready;
    this.setupServiceWorkerCommunication();
    this.blockFutureRegistrations(); // Block future registrations to prevent site from registering its own SW
  }

  setupServiceWorkerCommunication() {
    // Relay JSON-RPC requests from ServiceWorker to parent
    navigator.serviceWorker.addEventListener("message", (event) => {
      const { data } = event;
      if (data.jsonrpc === "2.0" && data.method && data.id !== undefined) {
        window.parent.postMessage(data, "*");
      }
    });
  }

  blockFutureRegistrations() {
    navigator.serviceWorker.register = () => {
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

  async loadSiteIndex() {
    console.log("loadSiteIndex: Starting...");

    // Check if we have a stored initial path from a refresh
    let initialPath = '/';
    try {
      const storedPath = sessionStorage.getItem('iframe_initial_path');
      if (storedPath) {
        initialPath = storedPath;
        // Clear the stored path after using it
        sessionStorage.removeItem('iframe_initial_path');
        console.log('loadSiteIndex: Loading SPA with initial path:', initialPath);
      }
    } catch (error) {
      console.warn('loadSiteIndex: Failed to read initial path from sessionStorage:', error);
    }

    // Store the initial path in sessionStorage for the new document to access
    if (initialPath && initialPath !== '/') {
      try {
        sessionStorage.setItem('spa_initial_path', initialPath);
        console.log('loadSiteIndex: Stored initial path for new document:', initialPath);
      } catch (error) {
        console.warn('loadSiteIndex: Failed to store initial path for new document:', error);
      }
    }

    const serializedRequest = {
      url: `${location.origin}/`,
      method: "GET",
      body: null,
      headers: {},
    };

    const response = await this.rpcClient.fetch(serializedRequest);

    if (response?.status !== 200) {
      throw new Error(`Failed to fetch site index: ${response?.status || 'Invalid response from site: ' + response} ${response?.statusText || ''}`);
    }

    if (response.headers["Content-Type"] !== "text/html") {
      throw new Error(`Unexpected Content-Type: ${response.headers["Content-Type"]}`);
    }

    const bytes = new Uint8Array(atob(response.body).split('').map(c => c.charCodeAt(0)));
    let text = new TextDecoder().decode(bytes);

    // Inject a script to set the initial path before the SPA loads
    const initialPathScript = `
      <script>
        // Set initial path for SPA navigation before app initialization
        (function() {
          // Store the initial path in multiple places for persistence
          const initialPath = ${JSON.stringify(initialPath)};
          window.__IFRAME_INITIAL_PATH__ = initialPath;
          try {
            sessionStorage.setItem('iframe_initial_path_backup', initialPath);
          } catch (e) {}

          console.log('[IFRAME] Initial path set:', initialPath);

          // Simple approach: force navigation after a short delay
          setTimeout(function() {
            const currentPath = window.location.pathname + window.location.search + window.location.hash;
            if (currentPath !== initialPath && initialPath !== '/') {
              console.log('[IFRAME] Forcing navigation to:', initialPath);
              window.history.pushState({}, '', initialPath);
              window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
            }
          }, 100);

          // Also try to intercept history methods
          const originalPushState = window.history.pushState;
          window.history.pushState = function(state, title, url) {
            if (!window.__IFRAME_INITIAL_NAVIGATION_CAPTURED__) {
              window.__IFRAME_INITIAL_NAVIGATION_CAPTURED__ = true;
              if (url === '/' || url === '/index.html') {
                console.log('[IFRAME] Redirecting initial navigation to:', initialPath);
                url = initialPath;
              }
            }
            return originalPushState.apply(this, arguments);
          };
        })();
      </script>
    `;

    // Inject the script at the beginning of the head to ensure it runs before the SPA
    text = text.replace('<head>', `<head>${initialPathScript}`);

    this.replaceDocument(text);
  }

  replaceDocument(htmlContent) {
    console.log("replaceDocument: Starting...");

    // Restore the initial path from sessionStorage before replacing document
    let initialPath = '/';
    try {
      const storedPath = sessionStorage.getItem('spa_initial_path');
      if (storedPath) {
        initialPath = storedPath;
        sessionStorage.removeItem('spa_initial_path');
        console.log('replaceDocument: Restored initial path:', initialPath);
        // Set it on window for the new document
        window.__IFRAME_INITIAL_PATH__ = initialPath;
      }
    } catch (error) {
      console.warn('replaceDocument: Failed to restore initial path:', error);
    }

    // Create a new document from the HTML content
    const parser = new DOMParser();
    const newDoc = parser.parseFromString(htmlContent, "text/html");

    // Extract scripts for re-execution
    const scripts = [];
    newDoc.querySelectorAll("script").forEach((script) => {
      scripts.push({
        src: script.src,
        type: script.type,
        async: script.hasAttribute("async"),
        defer: script.hasAttribute("defer"),
      });
      script.remove();
    });

    // Replace document content
    document.head.innerHTML = newDoc.head.innerHTML;
    document.body.innerHTML = newDoc.body.innerHTML;

    // Re-add scripts to execute them
    scripts.forEach((script) => {
      const newScript = document.createElement("script");
      newScript.src = script.src;
      newScript.type = script.type;
      if (script.async) newScript.async = true;
      if (script.defer) newScript.defer = true;
      document.body.appendChild(newScript);
    });

    console.log("Document replaced with site content");

    // Ensure initial navigation after document is loaded
    this.ensureInitialNavigation();
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

// Global error handlers
const setupGlobalErrorHandlers = () => {
  window.addEventListener('error', (event) => {
    try {
      window.parent.postMessage({
        jsonrpc: "2.0",
        method: "console",
        params: {
          level: "error",
          message: `Uncaught Error: ${event.message}`,
          source: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        }
      }, "*");
    } catch {
      // Ignore postMessage errors
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    try {
      window.parent.postMessage({
        jsonrpc: "2.0",
        method: "console",
        params: {
          level: "error",
          message: "Unhandled Promise Rejection",
          reason: event.reason,
          promise: event.promise ? 'Promise object' : 'No promise object'
        }
      }, "*");
    } catch {
      // Ignore postMessage errors
    }
  });
};

// Initialize
setupGlobalErrorHandlers();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new FetchClient());
} else {
  new FetchClient();
}