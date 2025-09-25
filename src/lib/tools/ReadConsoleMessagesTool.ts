import { Tool } from './Tool';

export interface ConsoleMessage {
  id: number;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  timestamp?: number;
}

export interface ReadConsoleMessagesParams {
  filter?: 'error' | 'warn' | 'info' | 'debug' | 'log' | 'all';
  limit?: number;
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

// Simple global console messages storage
const consoleMessages: ConsoleMessage[] = [];
const errorListeners: Array<(error: ProjectPreviewConsoleError) => void> = [];

export const addConsoleMessage = (level: ConsoleMessage['level'], message: string) => {
  const consoleMessage: ConsoleMessage = {
    id: Date.now() + Math.random(),
    level,
    message,
    timestamp: Date.now(),
  };

  consoleMessages.push(consoleMessage);

  // If this is an error, notify listeners
  if (level === 'error') {
    const recentErrors = getConsoleMessages().filter(msg =>
      msg.level === 'error' &&
      msg.timestamp &&
      Date.now() - msg.timestamp < 5000 // Last 5 seconds
    );

    if (recentErrors.length > 0) {
      const error = new ProjectPreviewConsoleError(
        `Console error detected: ${message}`,
        recentErrors
      );

      // Notify all listeners
      errorListeners.forEach(listener => {
        try {
          listener(error);
        } catch (err) {
          console.warn('Error listener failed:', err);
        }
      });
    }
  }
};

export const getConsoleMessages = (): ConsoleMessage[] => {
  return [...consoleMessages];
};

export const addErrorListener = (listener: (error: ProjectPreviewConsoleError) => void) => {
  errorListeners.push(listener);
};

export const removeErrorListener = (listener: (error: ProjectPreviewConsoleError) => void) => {
  const index = errorListeners.indexOf(listener);
  if (index > -1) {
    errorListeners.splice(index, 1);
  }
};

export const clearConsoleMessages = () => {
  consoleMessages.length = 0;
};

export class ReadConsoleMessagesTool implements Tool<ReadConsoleMessagesParams> {
  constructor() {
    // No longer need to pass getConsoleMessages function
  }

  async execute(params: ReadConsoleMessagesParams): Promise<string> {
    const { filter = 'all', limit } = params;

    // Get fresh console messages at execution time
    const messages = getConsoleMessages();
    let filteredMessages = messages;

    // Apply filter if specified
    if (filter !== 'all') {
      filteredMessages = messages.filter(msg => msg.level === filter);
    }

    // Apply limit if specified
    if (limit && limit > 0) {
      filteredMessages = filteredMessages.slice(-limit);
    }

    if (filteredMessages.length === 0) {
      return `No console messages found${filter !== 'all' ? ` for level: ${filter}` : ''}.`;
    }

    // Format the messages
    const formattedMessages = filteredMessages.map(msg => {
      const timestamp = new Date(msg.id).toLocaleTimeString();
      return `[${timestamp}] [${msg.level.toUpperCase()}] ${msg.message}`;
    }).join('\n');

    return `Found ${filteredMessages.length} console message${filteredMessages.length !== 1 ? 's' : ''}${filter !== 'all' ? ` (level: ${filter})` : ''}:\n\n${formattedMessages}`;
  }

  description = 'Read console messages from the project preview. Can filter by level and limit results.';
}