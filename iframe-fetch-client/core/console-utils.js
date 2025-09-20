/**
 * Shared console interception utilities
 */

// List of all console methods to intercept
export const CONSOLE_METHODS = [
  'log', 'warn', 'error', 'info', 'debug',
  'exception', 'assert', 'clear', 'count', 'countReset',
  'dir', 'dirxml', 'group', 'groupCollapsed', 'groupEnd',
  'table', 'time', 'timeEnd', 'timeLog', 'trace'
];

// Store original console methods
export function storeOriginalConsole() {
  const original = {};
  CONSOLE_METHODS.forEach(method => {
    if (typeof console[method] === 'function') {
      original[method] = console[method];
    }
  });
  return original;
}

// Override console methods with custom handler
export function overrideConsoleMethods(originalConsole, messageHandler) {
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
export function setupGlobalErrorHandlers(messageHandler) {
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