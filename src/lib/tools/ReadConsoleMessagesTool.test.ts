import { describe, it, expect, beforeEach } from 'vitest';
import { ReadConsoleMessagesTool } from './ReadConsoleMessagesTool';
import { ConsoleMessage, ProjectPreviewConsoleError } from '@/contexts/ConsoleContext';

describe('ReadConsoleMessagesTool', () => {
  let mockMessages: ConsoleMessage[];
  let getMessages: () => ConsoleMessage[];

  beforeEach(() => {
    // Set up test messages
    mockMessages = [
      { level: 'log', message: 'App started' },
      { level: 'warn', message: 'Deprecated API used' },
      { level: 'error', message: 'Network request failed' },
      { level: 'info', message: 'User logged in' },
    ];
    getMessages = () => mockMessages;
  });

  it('should return all messages by default', async () => {
    const tool = new ReadConsoleMessagesTool(getMessages);
    const result = await tool.execute({});

    expect(result).toContain('Found 4 console messages');
    expect(result).toContain('[LOG] App started');
    expect(result).toContain('[WARN] Deprecated API used');
    expect(result).toContain('[ERROR] Network request failed');
    expect(result).toContain('[INFO] User logged in');
  });

  it('should filter messages by level', async () => {
    const tool = new ReadConsoleMessagesTool(getMessages);
    const result = await tool.execute({ filter: 'error' });

    expect(result).toContain('Found 1 console message (level: error)');
    expect(result).toContain('[ERROR] Network request failed');
    expect(result).not.toContain('[LOG] App started');
  });

  it('should limit number of messages', async () => {
    const tool = new ReadConsoleMessagesTool(getMessages);
    const result = await tool.execute({ limit: 2 });

    expect(result).toContain('Found 2 console messages');
    // Should get the last 2 messages
    expect(result).toContain('[ERROR] Network request failed');
    expect(result).toContain('[INFO] User logged in');
    expect(result).not.toContain('[LOG] App started');
  });

  it('should handle no messages found', async () => {
    const emptyGetMessages = () => [];
    const tool = new ReadConsoleMessagesTool(emptyGetMessages);
    const result = await tool.execute({});

    expect(result).toBe('No console messages found.');
  });

  it('should handle no messages found with filter', async () => {
    const tool = new ReadConsoleMessagesTool(getMessages);
    const result = await tool.execute({ filter: 'debug' });

    expect(result).toBe('No console messages found for level: debug.');
  });
});

describe('ProjectPreviewConsoleError', () => {
  it('should create error with console logs', () => {
    const logs = [
      { level: 'error' as const, message: 'Test error' }
    ];
    const error = new ProjectPreviewConsoleError('Test message', logs);

    expect(error.message).toBe('Test message');
    expect(error.name).toBe('ProjectPreviewConsoleError');
    expect(error.logs).toEqual(logs);
    expect(error instanceof Error).toBe(true);
    expect(error instanceof ProjectPreviewConsoleError).toBe(true);
  });
});

// Console error listener tests are now handled by the ConsoleContext
// These tests should be moved to a separate ConsoleContext test file