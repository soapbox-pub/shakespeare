import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ReadConsoleMessagesTool,
  addConsoleMessage,
  clearConsoleMessages,
  ProjectPreviewConsoleError,
  addErrorListener,
  removeErrorListener
} from './ReadConsoleMessagesTool';

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

describe('Console Error Listeners', () => {
  beforeEach(() => {
    clearConsoleMessages();
  });

  it('should trigger error listener when console error is added', async () => {
    const errorListener = vi.fn();
    addErrorListener(errorListener);

    // Add an error message
    addConsoleMessage('error', 'Test error message');

    // Wait a bit for the listener to be called
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(errorListener).toHaveBeenCalledTimes(1);
    expect(errorListener).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Console error detected: Test error message',
        logs: expect.arrayContaining([
          expect.objectContaining({
            level: 'error',
            message: 'Test error message'
          })
        ])
      })
    );

    removeErrorListener(errorListener);
  });

  it('should not trigger error listener for non-error messages', async () => {
    const errorListener = vi.fn();
    addErrorListener(errorListener);

    // Add non-error messages
    addConsoleMessage('log', 'Test log message');
    addConsoleMessage('warn', 'Test warning message');
    addConsoleMessage('info', 'Test info message');

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(errorListener).not.toHaveBeenCalled();

    removeErrorListener(errorListener);
  });

  it('should remove error listener correctly', async () => {
    const errorListener = vi.fn();
    addErrorListener(errorListener);
    removeErrorListener(errorListener);

    // Add an error message
    addConsoleMessage('error', 'Test error message');

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(errorListener).not.toHaveBeenCalled();
  });

  it('should handle listener errors gracefully', async () => {
    const faultyListener = vi.fn(() => {
      throw new Error('Listener error');
    });
    const workingListener = vi.fn();

    addErrorListener(faultyListener);
    addErrorListener(workingListener);

    // Should not throw despite faulty listener
    expect(() => {
      addConsoleMessage('error', 'Test error message');
    }).not.toThrow();

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(faultyListener).toHaveBeenCalled();
    expect(workingListener).toHaveBeenCalled();

    removeErrorListener(faultyListener);
    removeErrorListener(workingListener);
  });
});