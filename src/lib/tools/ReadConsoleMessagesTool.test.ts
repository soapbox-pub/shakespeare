import { describe, it, expect } from 'vitest';
import { ReadConsoleMessagesTool } from './ReadConsoleMessagesTool';
import type { ConsoleMessage } from '@/types/console';

describe('ReadConsoleMessagesTool', () => {
  const mockMessages: ConsoleMessage[] = [
    { id: 1, level: 'log', message: 'App started', timestamp: Date.now() - 5000 },
    { id: 2, level: 'warn', message: 'Deprecated API used', timestamp: Date.now() - 3000 },
    { id: 3, level: 'error', message: 'Network request failed', timestamp: Date.now() - 1000 },
    { id: 4, level: 'info', message: 'User logged in', timestamp: Date.now() },
  ];

  it('should return all messages by default', async () => {
    const tool = new ReadConsoleMessagesTool(() => mockMessages);
    const result = await tool.execute({});
    
    expect(result).toContain('Found 4 console messages');
    expect(result).toContain('[LOG] App started');
    expect(result).toContain('[WARN] Deprecated API used');
    expect(result).toContain('[ERROR] Network request failed');
    expect(result).toContain('[INFO] User logged in');
  });

  it('should filter messages by level', async () => {
    const tool = new ReadConsoleMessagesTool(() => mockMessages);
    const result = await tool.execute({ filter: 'error' });
    
    expect(result).toContain('Found 1 console message (level: error)');
    expect(result).toContain('[ERROR] Network request failed');
    expect(result).not.toContain('[LOG] App started');
  });

  it('should limit number of messages', async () => {
    const tool = new ReadConsoleMessagesTool(() => mockMessages);
    const result = await tool.execute({ limit: 2 });
    
    expect(result).toContain('Found 2 console messages');
    // Should get the last 2 messages
    expect(result).toContain('[ERROR] Network request failed');
    expect(result).toContain('[INFO] User logged in');
    expect(result).not.toContain('[LOG] App started');
  });

  it('should handle no messages found', async () => {
    const tool = new ReadConsoleMessagesTool(() => []);
    const result = await tool.execute({});
    
    expect(result).toBe('No console messages found.');
  });

  it('should handle no messages found with filter', async () => {
    const tool = new ReadConsoleMessagesTool(() => mockMessages);
    const result = await tool.execute({ filter: 'debug' });
    
    expect(result).toBe('No console messages found for level: debug.');
  });
});