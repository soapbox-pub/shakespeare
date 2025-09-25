import { Tool } from './Tool';
import type { ConsoleMessage } from '@/types/console';

export interface ReadConsoleMessagesParams {
  filter?: 'error' | 'warn' | 'info' | 'debug' | 'log' | 'all';
  limit?: number;
}

export class ReadConsoleMessagesTool implements Tool<ReadConsoleMessagesParams> {
  private getConsoleMessages: () => ConsoleMessage[];

  constructor(getConsoleMessages: () => ConsoleMessage[]) {
    this.getConsoleMessages = getConsoleMessages;
  }

  async execute(params: ReadConsoleMessagesParams): Promise<string> {
    const { filter = 'all', limit } = params;

    // Get fresh console messages at execution time
    const consoleMessages = this.getConsoleMessages();
    let filteredMessages = consoleMessages;

    // Apply filter if specified
    if (filter !== 'all') {
      filteredMessages = consoleMessages.filter(msg => msg.level === filter);
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