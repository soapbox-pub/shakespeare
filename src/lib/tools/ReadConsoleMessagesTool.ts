import { Tool } from './Tool';

export interface ReadConsoleMessagesParams {
  filter?: 'error' | 'warn' | 'info' | 'debug' | 'log' | 'all';
  limit?: number;
}

export class ReadConsoleMessagesTool implements Tool<ReadConsoleMessagesParams> {
  constructor(private getMessages: () => import('@/contexts/ConsoleContext').ConsoleMessage[]) {}

  async execute(params: ReadConsoleMessagesParams): Promise<string> {
    const { filter = 'all', limit } = params;

    // Filter and limit messages in one chain
    const filteredMessages = this.getMessages()
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