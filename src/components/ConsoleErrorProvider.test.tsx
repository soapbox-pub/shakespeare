import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { ConsoleErrorProvider } from './ConsoleErrorProvider';
import { useConsoleError } from '@/hooks/useConsoleError';
import { addConsoleMessage, clearConsoleMessages, ProjectPreviewConsoleError } from '@/lib/consoleMessages';

// Wrapper component for testing
function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <ConsoleErrorProvider>
      {children}
    </ConsoleErrorProvider>
  );
}

describe('ConsoleErrorProvider', () => {
  beforeEach(() => {
    clearConsoleMessages();
  });

  it('should provide initial state with no errors', () => {
    const { result } = renderHook(() => useConsoleError(), {
      wrapper: TestWrapper,
    });

    expect(result.current.hasErrors).toBe(false);
    expect(result.current.consoleError).toBeNull();
  });

  it('should update hasErrors when console error is added', async () => {
    const { result } = renderHook(() => useConsoleError(), {
      wrapper: TestWrapper,
    });

    expect(result.current.hasErrors).toBe(false);

    // Add an error message
    act(() => {
      addConsoleMessage('error', 'Test error message');
    });

    expect(result.current.hasErrors).toBe(true);
    expect(result.current.consoleError).toBeInstanceOf(ProjectPreviewConsoleError);
    expect(result.current.consoleError?.message).toBe('Console error detected: Test error message');
  });

  it('should not update hasErrors for non-error messages', async () => {
    const { result } = renderHook(() => useConsoleError(), {
      wrapper: TestWrapper,
    });

    // Add non-error messages
    act(() => {
      addConsoleMessage('log', 'Test log message');
      addConsoleMessage('warn', 'Test warning message');
      addConsoleMessage('info', 'Test info message');
    });

    expect(result.current.hasErrors).toBe(false);
    expect(result.current.consoleError).toBeNull();
  });

  it('should update consoleError with latest error message', async () => {
    const { result } = renderHook(() => useConsoleError(), {
      wrapper: TestWrapper,
    });

    // Add first error
    act(() => {
      addConsoleMessage('error', 'First error');
    });

    expect(result.current.consoleError?.message).toBe('Console error detected: First error');

    // Add second error - should update to show latest error
    act(() => {
      addConsoleMessage('error', 'Second error');
    });

    // Wait for polling to detect the new error
    await waitFor(() => {
      expect(result.current.consoleError?.message).toBe('Console error detected: Second error');
    });

    expect(result.current.consoleError?.logs).toHaveLength(2);
  });

  it('should clear errors when clearErrors is called', async () => {
    const { result } = renderHook(() => useConsoleError(), {
      wrapper: TestWrapper,
    });

    // Add error to set state
    act(() => {
      addConsoleMessage('error', 'Test error message');
    });

    expect(result.current.hasErrors).toBe(true);
    expect(result.current.consoleError).not.toBeNull();

    // Clear errors
    act(() => {
      result.current.clearErrors();
    });

    expect(result.current.hasErrors).toBe(false);
    expect(result.current.consoleError).toBeNull();
  });

  it('should dismiss console error when dismissConsoleError is called', async () => {
    const { result } = renderHook(() => useConsoleError(), {
      wrapper: TestWrapper,
    });

    // Add error to create console error
    act(() => {
      addConsoleMessage('error', 'Test error message');
    });

    expect(result.current.consoleError).not.toBeNull();

    // Dismiss console error (this only clears the Quilly error, not the global state)
    act(() => {
      result.current.dismissConsoleError();
    });

    expect(result.current.consoleError).toBeNull();
    // hasErrors should still be true since we only dismissed the Quilly display
    expect(result.current.hasErrors).toBe(true);
  });

  it('should include all error messages in console error logs', async () => {
    const { result } = renderHook(() => useConsoleError(), {
      wrapper: TestWrapper,
    });

    // Add multiple errors and non-errors
    act(() => {
      addConsoleMessage('log', 'Log message');
      addConsoleMessage('error', 'First error');
      addConsoleMessage('warn', 'Warning message');
      addConsoleMessage('error', 'Second error');
      addConsoleMessage('info', 'Info message');
      addConsoleMessage('error', 'Third error');
    });

    // Wait for polling to detect all the new errors
    await waitFor(() => {
      expect(result.current.consoleError?.message).toBe('Console error detected: Third error');
    });

    expect(result.current.consoleError?.logs).toHaveLength(3);
    expect(result.current.consoleError?.logs.map(log => log.message)).toEqual([
      'First error',
      'Second error',
      'Third error'
    ]);
  });
});