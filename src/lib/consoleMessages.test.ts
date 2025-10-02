import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  addConsoleMessage,
  clearConsoleMessages,
  getConsoleMessages,
  getHasConsoleErrors,
  addConsoleMessageListener,
  removeConsoleMessageListener,
  ProjectPreviewConsoleError
} from './consoleMessages';

describe('Console Messages System', () => {
  beforeEach(() => {
    clearConsoleMessages();
  });

  describe('addConsoleMessage', () => {
    it('should add messages to the global store', () => {
      addConsoleMessage('log', 'Test log message');
      addConsoleMessage('error', 'Test error message');

      const messages = getConsoleMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ level: 'log', message: 'Test log message' });
      expect(messages[1]).toEqual({ level: 'error', message: 'Test error message' });
    });

    it('should update error state when error message is added', () => {
      expect(getHasConsoleErrors()).toBe(false);

      addConsoleMessage('log', 'Log message');
      expect(getHasConsoleErrors()).toBe(false);

      addConsoleMessage('error', 'Error message');
      expect(getHasConsoleErrors()).toBe(true);
    });

    it('should notify listeners when messages are added', () => {
      const listener = vi.fn();
      addConsoleMessageListener(listener);

      addConsoleMessage('error', 'First error');
      expect(listener).toHaveBeenCalledTimes(1);

      addConsoleMessage('error', 'Second error');
      expect(listener).toHaveBeenCalledTimes(2);

      removeConsoleMessageListener(listener);
    });
  });

  describe('getConsoleMessages', () => {
    it('should return a copy of messages array', () => {
      addConsoleMessage('info', 'Test message');

      const messages1 = getConsoleMessages();
      const messages2 = getConsoleMessages();

      expect(messages1).toEqual(messages2);
      expect(messages1).not.toBe(messages2); // Different array instances
    });

    it('should return empty array when no messages', () => {
      const messages = getConsoleMessages();
      expect(messages).toEqual([]);
    });
  });

  describe('clearConsoleMessages', () => {
    it('should clear all messages and reset error state', () => {
      addConsoleMessage('error', 'Error message');
      addConsoleMessage('log', 'Log message');

      expect(getConsoleMessages()).toHaveLength(2);
      expect(getHasConsoleErrors()).toBe(true);

      clearConsoleMessages();

      expect(getConsoleMessages()).toHaveLength(0);
      expect(getHasConsoleErrors()).toBe(false);
    });

    it('should notify listeners when messages are cleared', () => {
      const listener = vi.fn();
      addConsoleMessageListener(listener);

      addConsoleMessage('error', 'Error message');
      expect(listener).toHaveBeenCalledTimes(1);

      clearConsoleMessages();
      expect(listener).toHaveBeenCalledTimes(2);

      removeConsoleMessageListener(listener);
    });
  });

  describe('Message Listeners', () => {
    it('should add and remove listeners correctly', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      addConsoleMessageListener(listener1);
      addConsoleMessageListener(listener2);

      addConsoleMessage('error', 'Test error');

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      removeConsoleMessageListener(listener1);
      clearConsoleMessages();

      expect(listener1).toHaveBeenCalledTimes(1); // Only called once (not for clear)
      expect(listener2).toHaveBeenCalledTimes(2); // Called for both add and clear

      removeConsoleMessageListener(listener2);
    });

    it('should handle listener errors gracefully', () => {
      const faultyListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const workingListener = vi.fn();

      addConsoleMessageListener(faultyListener);
      addConsoleMessageListener(workingListener);

      // Should not throw despite faulty listener
      expect(() => {
        addConsoleMessage('error', 'Test error');
      }).not.toThrow();

      expect(faultyListener).toHaveBeenCalled();
      expect(workingListener).toHaveBeenCalled();

      removeConsoleMessageListener(faultyListener);
      removeConsoleMessageListener(workingListener);
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
});