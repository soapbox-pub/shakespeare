/**
 * Global console message storage and state management.
 * This module handles the core console message system that the AI tool reads from.
 */

export interface ConsoleMessage {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
}

/**
 * Custom error class for project preview console errors
 */
export class ProjectPreviewConsoleError extends Error {
  public readonly logs: ConsoleMessage[];

  constructor(message: string, logs: ConsoleMessage[]) {
    super(message);
    this.name = 'ProjectPreviewConsoleError';
    this.logs = logs;
  }
}

// Global console messages storage
const consoleMessages: ConsoleMessage[] = [];

// Boolean-based error detection system
let hasConsoleErrors = false;
const errorStateListeners: Array<(hasErrors: boolean) => void> = [];

export const addConsoleMessage = (level: ConsoleMessage['level'], message: string) => {
  const consoleMessage: ConsoleMessage = {
    level,
    message,
  };

  consoleMessages.push(consoleMessage);

  // Only update boolean state on first error
  if (level === 'error' && !hasConsoleErrors) {
    hasConsoleErrors = true;
    
    // Notify boolean state listeners
    errorStateListeners.forEach(listener => {
      try {
        listener(true);
      } catch (err) {
        console.warn('Error state listener failed:', err);
      }
    });
  }
};

export const addErrorStateListener = (listener: (hasErrors: boolean) => void) => {
  errorStateListeners.push(listener);
};

export const removeErrorStateListener = (listener: (hasErrors: boolean) => void) => {
  const index = errorStateListeners.indexOf(listener);
  if (index > -1) {
    errorStateListeners.splice(index, 1);
  }
};

export const getHasConsoleErrors = (): boolean => {
  return hasConsoleErrors;
};

export const getConsoleMessages = (): ConsoleMessage[] => {
  return [...consoleMessages];
};

export const clearConsoleMessages = () => {
  consoleMessages.length = 0;
  
  // Reset error state
  const hadErrors = hasConsoleErrors;
  hasConsoleErrors = false;
  
  // Notify listeners if state changed
  if (hadErrors) {
    errorStateListeners.forEach(listener => {
      try {
        listener(false);
      } catch (err) {
        console.warn('Error state listener failed:', err);
      }
    });
  }
};