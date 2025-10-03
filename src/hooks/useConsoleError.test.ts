import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useConsoleError } from './useConsoleError';

describe('useConsoleError', () => {
  it('should throw error when used outside ConsoleErrorProvider', () => {
    // Expect the hook to throw when not wrapped in provider
    expect(() => {
      renderHook(() => useConsoleError());
    }).toThrow('useConsoleError must be used within a ConsoleErrorProvider');
  });
});