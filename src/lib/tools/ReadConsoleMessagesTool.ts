import { Tool } from './Tool';
import { getConsoleMessages } from '@/lib/consoleMessages';

export interface ReadConsoleMessagesParams {
  filter?: 'error' | 'warn' | 'info' | 'debug' | 'log' | 'all';
  limit?: number;
}

/**
 * AI tool for reading console messages from the project preview.
 * This tool allows AI assistants to access console logs for debugging assistance.
 */
export class ReadConsoleMessagesTool implements Tool<ReadConsoleMessagesParams> {
  async execute(params: ReadConsoleMessagesParams): Promise<string> {
    const { filter = 'all', limit } = params;

    // Filter messages first
    let filteredMessages = getConsoleMessages()
      .filter(msg => filter === 'all' || msg.level === filter);

    // Apply limit if specified and positive
    if (limit !== undefined && limit >= 0) {
      if (limit === 0) {
        filteredMessages = [];
      } else {
        filteredMessages = filteredMessages.slice(-limit);
      }
    }

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