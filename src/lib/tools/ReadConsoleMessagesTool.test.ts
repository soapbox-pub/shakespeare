import { describe, it, expect } from 'vitest';
import { ReadConsoleMessagesTool } from './ReadConsoleMessagesTool';
import type { ConsoleMessage } from '@/types/console';

describe('ReadConsoleMessagesTool', () => {
  it('should get fresh console messages at execution time', async () => {
    // Create a mutable array that we can update
    const messages: ConsoleMessage[] = [
      { id: 1, level: 'error', message: 'Initial error', timestamp: Date.now() }
    ];

    // Create a getter function that returns the current state
    const getMessages = () => messages;

    // Create tool with the getter function
    const tool = new ReadConsoleMessagesTool(getMessages);

    // Execute tool - should see initial message
    const result1 = await tool.execute({});
    expect(result1).toContain('Initial error');
    expect(result1).toContain('Found 1 console message');

    // Update the messages array (simulating new console messages)
    messages.push({ id: 2, level: 'warn', message: 'New warning', timestamp: Date.now() });

    // Execute tool again - should see updated messages
    const result2 = await tool.execute({});
    expect(result2).toContain('Initial error');
    expect(result2).toContain('New warning');
    expect(result2).toContain('Found 2 console messages');
  });

  it('should filter messages correctly', async () => {
    const messages: ConsoleMessage[] = [
      { id: 1, level: 'error', message: 'Error message', timestamp: Date.now() },
      { id: 2, level: 'warn', message: 'Warning message', timestamp: Date.now() },
      { id: 3, level: 'info', message: 'Info message', timestamp: Date.now() }
    ];

    const tool = new ReadConsoleMessagesTool(() => messages);

    // Test error filter
    const errorResult = await tool.execute({ filter: 'error' });
    expect(errorResult).toContain('Error message');
    expect(errorResult).not.toContain('Warning message');
    expect(errorResult).not.toContain('Info message');
    expect(errorResult).toContain('Found 1 console message (level: error)');

    // Test warn filter
    const warnResult = await tool.execute({ filter: 'warn' });
    expect(warnResult).toContain('Warning message');
    expect(warnResult).not.toContain('Error message');
    expect(warnResult).not.toContain('Info message');
  });

  it('should limit messages correctly', async () => {
    const messages: ConsoleMessage[] = [
      { id: 1, level: 'log', message: 'Message 1', timestamp: Date.now() },
      { id: 2, level: 'log', message: 'Message 2', timestamp: Date.now() },
      { id: 3, level: 'log', message: 'Message 3', timestamp: Date.now() },
      { id: 4, level: 'log', message: 'Message 4', timestamp: Date.now() },
      { id: 5, level: 'log', message: 'Message 5', timestamp: Date.now() }
    ];

    const tool = new ReadConsoleMessagesTool(() => messages);

    // Test limit to 2 messages (should get the last 2)
    const result = await tool.execute({ limit: 2 });
    expect(result).toContain('Message 4');
    expect(result).toContain('Message 5');
    expect(result).not.toContain('Message 1');
    expect(result).not.toContain('Message 2');
    expect(result).not.toContain('Message 3');
    expect(result).toContain('Found 2 console messages');
  });

  it('should handle empty messages array', async () => {
    const messages: ConsoleMessage[] = [];
    const tool = new ReadConsoleMessagesTool(() => messages);

    const result = await tool.execute({});
    expect(result).toBe('No console messages found.');
  });

  it('should handle no messages matching filter', async () => {
    const messages: ConsoleMessage[] = [
      { id: 1, level: 'info', message: 'Info message', timestamp: Date.now() }
    ];

    const tool = new ReadConsoleMessagesTool(() => messages);

    const result = await tool.execute({ filter: 'error' });
    expect(result).toBe('No console messages found for level: error.');
  });
});