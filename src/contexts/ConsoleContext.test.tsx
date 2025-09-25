import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ConsoleProvider, useConsole } from './ConsoleContext';
import { ProjectPreviewConsoleError } from '@/lib/errors/ProjectPreviewConsoleError';

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ConsoleProvider>{children}</ConsoleProvider>;
}

describe('ConsoleContext', () => {
  it('should provide console functionality', () => {
    const { result } = renderHook(() => useConsole(), { wrapper: TestWrapper });

    expect(result.current.messages).toEqual([]);
    expect(result.current.messagesRef.current).toEqual([]);
    expect(typeof result.current.addMessage).toBe('function');
    expect(typeof result.current.clearMessages).toBe('function');
    expect(typeof result.current.addErrorListener).toBe('function');
    expect(typeof result.current.removeErrorListener).toBe('function');
  });

  it('should add and retrieve messages', () => {
    const { result } = renderHook(() => useConsole(), { wrapper: TestWrapper });

    act(() => {
      result.current.addMessage('log', 'Test log message');
      result.current.addMessage('error', 'Test error message');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messagesRef.current).toHaveLength(2);
    expect(result.current.messages[0]).toEqual({
      level: 'log',
      message: 'Test log message',
    });
    expect(result.current.messagesRef.current[0]).toEqual({
      level: 'log',
      message: 'Test log message',
    });
    expect(result.current.messages[1]).toEqual({
      level: 'error',
      message: 'Test error message',
    });
    expect(result.current.messagesRef.current[1]).toEqual({
      level: 'error',
      message: 'Test error message',
    });
  });

  it('should clear messages', () => {
    const { result } = renderHook(() => useConsole(), { wrapper: TestWrapper });

    act(() => {
      result.current.addMessage('log', 'Test message');
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messagesRef.current).toHaveLength(1);

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.messagesRef.current).toHaveLength(0);
  });

  it('should trigger error listener when error message is added', () => {
    const { result } = renderHook(() => useConsole(), { wrapper: TestWrapper });
    const errorListener = vi.fn();

    act(() => {
      result.current.addErrorListener(errorListener);
    });

    act(() => {
      result.current.addMessage('error', 'Test error message');
    });

    expect(errorListener).toHaveBeenCalledTimes(1);
    expect(errorListener).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Console error detected: Test error message',
        logs: expect.arrayContaining([
          expect.objectContaining({
            level: 'error',
            message: 'Test error message',
          }),
        ]),
      })
    );
  });

  it('should not trigger error listener for non-error messages', () => {
    const { result } = renderHook(() => useConsole(), { wrapper: TestWrapper });
    const errorListener = vi.fn();

    act(() => {
      result.current.addErrorListener(errorListener);
    });

    act(() => {
      result.current.addMessage('log', 'Test log message');
      result.current.addMessage('warn', 'Test warning message');
      result.current.addMessage('info', 'Test info message');
    });

    expect(errorListener).not.toHaveBeenCalled();
  });

  it('should remove error listener correctly', () => {
    const { result } = renderHook(() => useConsole(), { wrapper: TestWrapper });
    const errorListener = vi.fn();

    act(() => {
      result.current.addErrorListener(errorListener);
      result.current.removeErrorListener(errorListener);
    });

    act(() => {
      result.current.addMessage('error', 'Test error message');
    });

    expect(errorListener).not.toHaveBeenCalled();
  });

  it('should handle listener errors gracefully', () => {
    const { result } = renderHook(() => useConsole(), { wrapper: TestWrapper });
    const faultyListener = vi.fn(() => {
      throw new Error('Listener error');
    });
    const workingListener = vi.fn();

    act(() => {
      result.current.addErrorListener(faultyListener);
      result.current.addErrorListener(workingListener);
    });

    // Should not throw despite faulty listener
    expect(() => {
      act(() => {
        result.current.addMessage('error', 'Test error message');
      });
    }).not.toThrow();

    expect(faultyListener).toHaveBeenCalled();
    expect(workingListener).toHaveBeenCalled();
  });

  it('should throw error when used outside provider', () => {
    expect(() => {
      renderHook(() => useConsole());
    }).toThrow('useConsole must be used within a ConsoleProvider');
  });
});

describe('ProjectPreviewConsoleError', () => {
  it('should create error with console logs', () => {
    const logs = [{ level: 'error' as const, message: 'Test error' }];
    const error = new ProjectPreviewConsoleError('Test message', logs);

    expect(error.message).toBe('Test message');
    expect(error.name).toBe('ProjectPreviewConsoleError');
    expect(error.logs).toEqual(logs);
    expect(error instanceof Error).toBe(true);
    expect(error instanceof ProjectPreviewConsoleError).toBe(true);
  });
});