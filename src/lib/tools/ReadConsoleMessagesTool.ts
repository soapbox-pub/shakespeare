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

    let messages = getConsoleMessages()
      .filter(msg => filter === 'all' || msg.level === filter);

    if (limit && limit > 0) {
      messages = messages.slice(-limit);
    }

    if (messages.length === 0) {
      return `No console messages found${filter !== 'all' ? ` for level: ${filter}` : ''}.`;
    }

    const formatted = messages
      .map(msg => `[${msg.level.toUpperCase()}] ${msg.message}`)
      .join('\n');

    const suffix = filter !== 'all' ? ` (level: ${filter})` : '';
    return `Found ${messages.length} console message${messages.length !== 1 ? 's' : ''}${suffix}:\n\n${formatted}`;
  }

  description = 'Read console messages from the project preview. Can filter by level and limit results.';
}