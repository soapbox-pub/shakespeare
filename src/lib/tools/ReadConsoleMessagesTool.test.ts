import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ReadConsoleMessagesTool,
  addConsoleMessage,
  clearConsoleMessages,
  ProjectPreviewConsoleError,
  addErrorStateListener,
  removeErrorStateListener,
  getHasConsoleErrors
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

describe('Console Error State Management', () => {
  beforeEach(() => {
    clearConsoleMessages();
  });

  it('should track error state with boolean', () => {
    expect(getHasConsoleErrors()).toBe(false);

    // Add non-error messages - should not change state
    addConsoleMessage('log', 'Test log message');
    addConsoleMessage('warn', 'Test warning message');
    expect(getHasConsoleErrors()).toBe(false);

    // Add error message - should change state
    addConsoleMessage('error', 'Test error message');
    expect(getHasConsoleErrors()).toBe(true);

    // Add another error - should remain true
    addConsoleMessage('error', 'Another error');
    expect(getHasConsoleErrors()).toBe(true);
  });

  it('should trigger error state listener when error state changes', async () => {
    const errorStateListener = vi.fn();
    addErrorStateListener(errorStateListener);

    // Add non-error messages - should not trigger
    addConsoleMessage('log', 'Test log message');
    addConsoleMessage('warn', 'Test warning message');

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(errorStateListener).not.toHaveBeenCalled();

    // Add error message - should trigger with true
    addConsoleMessage('error', 'Test error message');

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(errorStateListener).toHaveBeenCalledTimes(1);
    expect(errorStateListener).toHaveBeenCalledWith(true);

    // Add another error - should not trigger again (already true)
    addConsoleMessage('error', 'Another error');

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(errorStateListener).toHaveBeenCalledTimes(1); // Still only called once

    removeErrorStateListener(errorStateListener);
  });

  it('should reset error state when clearing messages', async () => {
    const errorStateListener = vi.fn();
    addErrorStateListener(errorStateListener);

    // Add error to set state to true
    addConsoleMessage('error', 'Test error message');
    expect(getHasConsoleErrors()).toBe(true);

    // Clear messages - should reset state and notify
    clearConsoleMessages();
    expect(getHasConsoleErrors()).toBe(false);

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(errorStateListener).toHaveBeenCalledTimes(2);
    expect(errorStateListener).toHaveBeenNthCalledWith(1, true);  // First call when error added
    expect(errorStateListener).toHaveBeenNthCalledWith(2, false); // Second call when cleared

    removeErrorStateListener(errorStateListener);
  });

  it('should remove error state listener correctly', async () => {
    const errorStateListener = vi.fn();
    addErrorStateListener(errorStateListener);
    removeErrorStateListener(errorStateListener);

    // Add an error message
    addConsoleMessage('error', 'Test error message');

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(errorStateListener).not.toHaveBeenCalled();
  });

  it('should handle listener errors gracefully', async () => {
    const faultyListener = vi.fn(() => {
      throw new Error('Listener error');
    });
    const workingListener = vi.fn();

    addErrorStateListener(faultyListener);
    addErrorStateListener(workingListener);

    // Should not throw despite faulty listener
    expect(() => {
      addConsoleMessage('error', 'Test error message');
    }).not.toThrow();

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(faultyListener).toHaveBeenCalled();
    expect(workingListener).toHaveBeenCalled();

    removeErrorStateListener(faultyListener);
    removeErrorStateListener(workingListener);
  });
});