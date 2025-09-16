import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import React from 'react';
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

// Mock the config utils
vi.mock('@/lib/configUtils', () => ({
  readAISettings: vi.fn(),
  writeAISettings: vi.fn(),
}));

describe('AISettingsProvider', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);

    // Mock the read function to return default settings
    const { readAISettings } = await import('@/lib/configUtils');
    vi.mocked(readAISettings).mockResolvedValue({
      providers: {},
      recentlyUsedModels: [],
    });
  });

  it('should initialize with empty recentlyUsedModels array', async () => {
    const { result } = renderHook(() => useAISettings(), {
      wrapper: ({ children }) => <TestApp>{children}</TestApp>,
    });

    await waitFor(() => {
      expect(result.current.settings.recentlyUsedModels).toEqual([]);
    });
  });

  it('should add recently used models correctly', async () => {
    const { result } = renderHook(() => useAISettings(), {
      wrapper: ({ children }) => <TestApp>{children}</TestApp>,
    });

    await waitFor(() => {
      expect(result.current.settings.recentlyUsedModels).toEqual([]);
    });

    act(() => {
      result.current.addRecentlyUsedModel('openrouter/anthropic/claude-3.5-sonnet');
    });

    expect(result.current.settings.recentlyUsedModels).toEqual([
      'openrouter/anthropic/claude-3.5-sonnet'
    ]);
  });

  it('should move existing model to front when used again', async () => {
    const { result } = renderHook(() => useAISettings(), {
      wrapper: ({ children }) => <TestApp>{children}</TestApp>,
    });

    await waitFor(() => {
      expect(result.current.settings.recentlyUsedModels).toEqual([]);
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

  it('should limit recently used models to 10 items', async () => {
    const { result } = renderHook(() => useAISettings(), {
      wrapper: ({ children }) => <TestApp>{children}</TestApp>,
    });

    await waitFor(() => {
      expect(result.current.settings.recentlyUsedModels).toEqual([]);
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

  it('should migrate old settings without recentlyUsedModels', async () => {
    const oldSettings = {
      providers: {
        openrouter: {
          baseURL: 'https://openrouter.ai/api/v1',
          apiKey: 'test-key'
        }
      },
      recentlyUsedModels: []
    };

    const { readAISettings } = await import('@/lib/configUtils');
    vi.mocked(readAISettings).mockResolvedValue(oldSettings);

    const { result } = renderHook(() => useAISettings(), {
      wrapper: ({ children }) => <TestApp>{children}</TestApp>,
    });

    await waitFor(() => {
      expect(result.current.settings.recentlyUsedModels).toEqual([]);
      expect(result.current.settings.providers).toEqual(oldSettings.providers);
    });
  });

  it('should invalidate provider-models query when updateSettings is called with providers', async () => {
    // Mock the QueryClient.invalidateQueries method
    const mockInvalidateQueries = vi.fn();

    // Create a custom TestApp that mocks the query client
    const MockedTestApp = ({ children }: { children: React.ReactNode }) => {
      const queryClient = useQueryClient();
      vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(mockInvalidateQueries);
      return <>{children}</>;
    };

    const { result } = renderHook(() => useAISettings(), {
      wrapper: ({ children }) => (
        <TestApp>
          <MockedTestApp>{children}</MockedTestApp>
        </TestApp>
      ),
    });

    await waitFor(() => {
      expect(result.current.settings.recentlyUsedModels).toEqual([]);
    });

    act(() => {
      result.current.updateSettings({
        providers: {
          'test-provider': {
            baseURL: 'https://api.test.com/v1',
            apiKey: 'test-key'
          }
        }
      });
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['provider-models'] });
  });

  it('should not invalidate provider-models query when updateSettings is called without providers', async () => {
    // Mock the QueryClient.invalidateQueries method
    const mockInvalidateQueries = vi.fn();

    // Create a custom TestApp that mocks the query client
    const MockedTestApp = ({ children }: { children: React.ReactNode }) => {
      const queryClient = useQueryClient();
      vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(mockInvalidateQueries);
      return <>{children}</>;
    };

    const { result } = renderHook(() => useAISettings(), {
      wrapper: ({ children }) => (
        <TestApp>
          <MockedTestApp>{children}</MockedTestApp>
        </TestApp>
      ),
    });

    await waitFor(() => {
      expect(result.current.settings.recentlyUsedModels).toEqual([]);
    });

    act(() => {
      result.current.updateSettings({
        recentlyUsedModels: ['test-model']
      });
    });

    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });
});