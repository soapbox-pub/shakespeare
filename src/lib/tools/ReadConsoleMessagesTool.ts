import { Tool } from './Tool';

export interface ConsoleMessage {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
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
    level,
    message,
  };

  consoleMessages.push(consoleMessage);

  // If this is an error, notify listeners
  if (level === 'error') {
    const error = new ProjectPreviewConsoleError(
      `Console error detected: ${message}`,
      consoleMessages.filter(msg => msg.level === 'error')
    );

    errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.warn('Error listener failed:', err);
      }
    });
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
  async execute(params: ReadConsoleMessagesParams): Promise<string> {
    const { filter = 'all', limit } = params;

    // Filter and limit messages in one chain
    const filteredMessages = getConsoleMessages()
      .filter(msg => filter === 'all' || msg.level === filter)
      .slice(limit && limit > 0 ? -limit : 0);

    if (filteredMessages.length === 0) {
      return `No console messages found${filter !== 'all' ? ` for level: ${filter}` : ''}.`;
    }

    const formattedMessages = filteredMessages
      .map(msg => `[${msg.level.toUpperCase()}] ${msg.message}`)
      .join('\n');

    const plural = filteredMessages.length !== 1 ? 's' : '';
    const levelInfo = filter !== 'all' ? ` (level: ${filter})` : '';

    return `Found ${filteredMessages.length} console message${plural}${levelInfo}:\n\n${formattedMessages}`;
  }

  description = 'Read console messages from the project preview. Can filter by level and limit results.';
}