import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAISettings } from '@/hooks/useAISettings';
import { TestApp } from '@/test/TestApp';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('AISettingsProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('should initialize with empty recentlyUsedModels array', () => {
    const { result } = renderHook(() => useAISettings(), {
      wrapper: ({ children }) => <TestApp>{children}</TestApp>,
    });

    expect(result.current.settings.recentlyUsedModels).toEqual([]);
  });

  it('should add recently used models correctly', () => {
    const { result } = renderHook(() => useAISettings(), {
      wrapper: ({ children }) => <TestApp>{children}</TestApp>,
    });

    act(() => {
      result.current.addRecentlyUsedModel('openrouter/anthropic/claude-3.5-sonnet');
    });

    expect(result.current.settings.recentlyUsedModels).toEqual([
      'openrouter/anthropic/claude-3.5-sonnet'
    ]);
  });

  it('should move existing model to front when used again', () => {
    const { result } = renderHook(() => useAISettings(), {
      wrapper: ({ children }) => <TestApp>{children}</TestApp>,
    });

    // Add multiple models
    act(() => {
      result.current.addRecentlyUsedModel('openrouter/anthropic/claude-3.5-sonnet');
      result.current.addRecentlyUsedModel('openrouter/openai/gpt-4');
      result.current.addRecentlyUsedModel('openrouter/google/gemini-pro');
    });

    expect(result.current.settings.recentlyUsedModels).toEqual([
      'openrouter/google/gemini-pro',
      'openrouter/openai/gpt-4',
      'openrouter/anthropic/claude-3.5-sonnet'
    ]);

    // Use the first model again - it should move to front
    act(() => {
      result.current.addRecentlyUsedModel('openrouter/anthropic/claude-3.5-sonnet');
    });

    expect(result.current.settings.recentlyUsedModels).toEqual([
      'openrouter/anthropic/claude-3.5-sonnet',
      'openrouter/google/gemini-pro',
      'openrouter/openai/gpt-4'
    ]);
  });

  it('should limit recently used models to 10 items', () => {
    const { result } = renderHook(() => useAISettings(), {
      wrapper: ({ children }) => <TestApp>{children}</TestApp>,
    });

    // Add 12 models
    act(() => {
      for (let i = 1; i <= 12; i++) {
        result.current.addRecentlyUsedModel(`provider/model-${i}`);
      }
    });

    // Should only keep the last 10
    expect(result.current.settings.recentlyUsedModels).toHaveLength(10);
    expect(result.current.settings.recentlyUsedModels[0]).toBe('provider/model-12');
    expect(result.current.settings.recentlyUsedModels[9]).toBe('provider/model-3');
  });

  it('should migrate old settings without recentlyUsedModels', () => {
    const oldSettings = {
      providers: {
        openrouter: {
          baseURL: 'https://openrouter.ai/api/v1',
          apiKey: 'test-key'
        }
      }
    };

    localStorageMock.getItem.mockReturnValue(JSON.stringify(oldSettings));

    const { result } = renderHook(() => useAISettings(), {
      wrapper: ({ children }) => <TestApp>{children}</TestApp>,
    });

    expect(result.current.settings.recentlyUsedModels).toEqual([]);
    expect(result.current.settings.providers).toEqual(oldSettings.providers);
  });
});