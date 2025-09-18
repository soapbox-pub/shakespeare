/**
 * Early Console Interception Inject Script
 * This script runs as early as possible to capture all console messages and errors
 */

class ConsoleInterceptor {
  constructor() {
    this.originalConsole = {};
    this.earlyErrors = [];
    this.consoleMethods = [
      'log', 'warn', 'error', 'info', 'debug', 'exception', 'assert',
      'clear', 'count', 'countReset', 'dir', 'dirxml', 'group',
      'groupCollapsed', 'groupEnd', 'table', 'time', 'timeEnd',
      'timeLog', 'trace'
    ];

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
        message: this.serializeArgs(args),
        timestamp: Date.now(),
        args: args
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
        message: `Global Error: ${event.message}`,
        timestamp: Date.now(),
        args: [{
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error ? event.error.message : 'No error object'
        }]
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.earlyErrors.push({
        level: 'error',
        message: 'Unhandled Promise Rejection',
        timestamp: Date.now(),
        args: [event.reason]
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

// Initialize the console interceptor immediately
new ConsoleInterceptor();