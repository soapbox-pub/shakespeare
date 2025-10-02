import { describe, it, expect, beforeEach } from 'vitest';
import { ReadConsoleMessagesTool } from './ReadConsoleMessagesTool';
import { addConsoleMessage, clearConsoleMessages } from '@/lib/consoleMessages';

describe('ReadConsoleMessagesTool', () => {
  beforeEach(() => {
    clearConsoleMessages();
    // Add test messages
    addConsoleMessage('log', 'App started');
    addConsoleMessage('warn', 'Deprecated API used');
    addConsoleMessage('error', 'Network request failed');
    addConsoleMessage('info', 'User logged in');
  });

  it('should return all messages by default', async () => {
    const tool = new ReadConsoleMessagesTool();
    const result = await tool.execute({});

    expect(result).toContain('Found 4 console messages');
    expect(result).toContain('[LOG] App started');
    expect(result).toContain('[WARN] Deprecated API used');
    expect(result).toContain('[ERROR] Network request failed');
    expect(result).toContain('[INFO] User logged in');
  });

  it('should filter messages by level', async () => {
    const tool = new ReadConsoleMessagesTool();
    const result = await tool.execute({ filter: 'error' });

    expect(result).toContain('Found 1 console message (level: error)');
    expect(result).toContain('[ERROR] Network request failed');
    expect(result).not.toContain('[LOG] App started');
  });

  it('should limit number of messages', async () => {
    const tool = new ReadConsoleMessagesTool();
    const result = await tool.execute({ limit: 2 });

    expect(result).toContain('Found 2 console messages');
    // Should get the last 2 messages
    expect(result).toContain('[ERROR] Network request failed');
    expect(result).toContain('[INFO] User logged in');
    expect(result).not.toContain('[LOG] App started');
  });

  it('should handle no messages found', async () => {
    clearConsoleMessages();
    const tool = new ReadConsoleMessagesTool();
    const result = await tool.execute({});

    expect(result).toBe('No console messages found.');
  });

  it('should handle no messages found with filter', async () => {
    const tool = new ReadConsoleMessagesTool();
    const result = await tool.execute({ filter: 'debug' });

    expect(result).toBe('No console messages found for level: debug.');
  });

  it('should handle all filter levels', async () => {
    const tool = new ReadConsoleMessagesTool();

    // Test each filter level
    const errorResult = await tool.execute({ filter: 'error' });
    expect(errorResult).toContain('[ERROR] Network request failed');

    const warnResult = await tool.execute({ filter: 'warn' });
    expect(warnResult).toContain('[WARN] Deprecated API used');

    const logResult = await tool.execute({ filter: 'log' });
    expect(logResult).toContain('[LOG] App started');

    const infoResult = await tool.execute({ filter: 'info' });
    expect(infoResult).toContain('[INFO] User logged in');
  });

  it('should format messages correctly', async () => {
    clearConsoleMessages();
    addConsoleMessage('error', 'Test error with special chars: <>&"');

    const tool = new ReadConsoleMessagesTool();
    const result = await tool.execute({});

    expect(result).toContain('[ERROR] Test error with special chars: <>&"');
  });

  it('should handle limit edge cases', async () => {
    const tool = new ReadConsoleMessagesTool();

    // Limit of 0 should return no messages
    const zeroResult = await tool.execute({ limit: 0 });
    expect(zeroResult).toBe('No console messages found.');

    // Negative limit should return all messages
    const negativeResult = await tool.execute({ limit: -1 });
    expect(negativeResult).toContain('Found 4 console messages');

    // Limit larger than available should return all
    const largeResult = await tool.execute({ limit: 100 });
    expect(largeResult).toContain('Found 4 console messages');
  });
});