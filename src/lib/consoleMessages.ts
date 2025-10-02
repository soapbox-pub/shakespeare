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
const listeners: Array<() => void> = [];

const notifyListeners = () => {
  listeners.forEach(listener => {
    try {
      listener();
    } catch (err) {
      console.warn('Console message listener failed:', err);
    }
  });
};

export const addConsoleMessage = (level: ConsoleMessage['level'], message: string) => {
  consoleMessages.push({ level, message });
  notifyListeners();
};

export const addConsoleMessageListener = (listener: () => void) => {
  listeners.push(listener);
};

export const removeConsoleMessageListener = (listener: () => void) => {
  const index = listeners.indexOf(listener);
  if (index > -1) {
    listeners.splice(index, 1);
  }
};

export const getHasConsoleErrors = (): boolean => {
  return consoleMessages.some(msg => msg.level === 'error');
};

export const getConsoleMessages = (): ConsoleMessage[] => {
  return [...consoleMessages];
};

export const clearConsoleMessages = () => {
  consoleMessages.length = 0;
  notifyListeners();
};