import { z } from 'zod';
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
  readonly description = 'Read console messages from the project preview. Can filter by level and limit results.';

  readonly inputSchema = z.object({
    filter: z.enum(['error', 'warn', 'info', 'debug', 'log', 'all']).optional().describe(
      'Filter messages by level. Defaults to "all" to show all message types.'
    ),
    limit: z.number().min(1).max(200).optional().describe(
      'Maximum number of most recent messages to return. Defaults to 50. Use smaller values (10-20) for quick checks, larger values (100-200) for comprehensive debugging.'
    ),
  });

  async execute(params: ReadConsoleMessagesParams): Promise<string> {
    const { filter = 'all', limit = 50 } = params;

    let messages = getConsoleMessages()
      .filter(msg => filter === 'all' || msg.level === filter);

    // Always apply a limit to prevent unbounded output
    messages = messages.slice(-limit);

    if (messages.length === 0) {
      return `No console messages found${filter !== 'all' ? ` for level: ${filter}` : ''}.`;
    }

    const formatted = messages
      .map(msg => `[${msg.level.toUpperCase()}] ${msg.message}`)
      .join('\n');

    const suffix = filter !== 'all' ? ` (level: ${filter})` : '';
    const totalAvailable = getConsoleMessages().filter(msg => filter === 'all' || msg.level === filter).length;
    const truncatedNote = totalAvailable > messages.length ? ` (showing last ${messages.length} of ${totalAvailable})` : '';

    return `Found ${messages.length} console message${messages.length !== 1 ? 's' : ''}${suffix}${truncatedNote}:\n\n${formatted}`;
  }
}