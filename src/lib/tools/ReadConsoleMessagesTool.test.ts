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

    expect(result.content).toContain('Found 4 console messages');
    expect(result.content).toContain('[LOG] App started');
    expect(result.content).toContain('[WARN] Deprecated API used');
    expect(result.content).toContain('[ERROR] Network request failed');
    expect(result.content).toContain('[INFO] User logged in');
  });

  it('should filter messages by level', async () => {
    const tool = new ReadConsoleMessagesTool();
    const result = await tool.execute({ filter: 'error' });

    expect(result.content).toContain('Found 1 console message (level: error)');
    expect(result.content).toContain('[ERROR] Network request failed');
    expect(result.content).not.toContain('[LOG] App started');
  });

  it('should limit number of messages', async () => {
    const tool = new ReadConsoleMessagesTool();
    const result = await tool.execute({ limit: 2 });

    expect(result.content).toContain('Found 2 console messages');
    // Should get the last 2 messages
    expect(result.content).toContain('[ERROR] Network request failed');
    expect(result.content).toContain('[INFO] User logged in');
    expect(result.content).not.toContain('[LOG] App started');
  });

  it('should handle no messages found', async () => {
    clearConsoleMessages();
    const tool = new ReadConsoleMessagesTool();
    const result = await tool.execute({});

    expect(result.content).toBe('No console messages found.');
  });

  it('should handle no messages found with filter', async () => {
    const tool = new ReadConsoleMessagesTool();
    const result = await tool.execute({ filter: 'debug' });

    expect(result.content).toBe('No console messages found for level: debug.');
  });

  it('should handle all filter levels', async () => {
    const tool = new ReadConsoleMessagesTool();

    // Test each filter level
    const errorResult = await tool.execute({ filter: 'error' });
    expect(errorResult.content).toContain('[ERROR] Network request failed');

    const warnResult = await tool.execute({ filter: 'warn' });
    expect(warnResult.content).toContain('[WARN] Deprecated API used');

    const logResult = await tool.execute({ filter: 'log' });
    expect(logResult.content).toContain('[LOG] App started');

    const infoResult = await tool.execute({ filter: 'info' });
    expect(infoResult.content).toContain('[INFO] User logged in');
  });

  it('should format messages correctly', async () => {
    clearConsoleMessages();
    addConsoleMessage('error', 'Test error with special chars: <>&"');

    const tool = new ReadConsoleMessagesTool();
    const result = await tool.execute({});

    expect(result.content).toContain('[ERROR] Test error with special chars: <>&"');
  });

  it('should handle limit correctly', async () => {
    const tool = new ReadConsoleMessagesTool();

    // Limit should return only the most recent messages
    const limitedResult = await tool.execute({ limit: 2 });
    expect(limitedResult.content).toContain('Found 2 console messages');

    // Default limit (50) should return all messages when total is less than 50
    const allResult = await tool.execute({});
    expect(allResult.content).toContain('Found 4 console messages');
  });

  it('should show truncation note when messages exceed limit', async () => {
    clearConsoleMessages();
    // Add more messages than the limit
    for (let i = 1; i <= 60; i++) {
      addConsoleMessage('log', `Message ${i}`);
    }

    const tool = new ReadConsoleMessagesTool();

    // Default limit is 50
    const result = await tool.execute({});
    expect(result.content).toContain('(showing last 50 of 60)');
    expect(result.content).toContain('Message 60'); // Most recent
    expect(result.content).not.toContain('Message 10'); // Too old

    // Custom limit
    const limitedResult = await tool.execute({ limit: 10 });
    expect(limitedResult.content).toContain('(showing last 10 of 60)');
  });
});