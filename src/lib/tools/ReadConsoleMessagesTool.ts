import { Tool } from './Tool';
import type { ConsoleMessage } from '@/types/console';

export interface ReadConsoleMessagesParams {
  filter?: 'error' | 'warn' | 'info' | 'debug' | 'log' | 'all';
  limit?: number;
}

// Simple global console messages storage
const consoleMessages: ConsoleMessage[] = [];

export const addConsoleMessage = (level: ConsoleMessage['level'], message: string) => {
  consoleMessages.push({
    id: Date.now() + Math.random(),
    level,
    message,
    timestamp: Date.now(),
  });
};

export const getConsoleMessages = (): ConsoleMessage[] => {
  return [...consoleMessages];
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