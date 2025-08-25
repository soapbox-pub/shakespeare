import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAIProjectId } from './useAIProjectId';
import { useAISettings } from './useAISettings';

// Mock the useAISettings hook
vi.mock('./useAISettings');

describe('useAIProjectId', () => {
  const mockUseAISettings = vi.mocked(useAISettings);

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  it('should return not configured when AI settings are not configured', () => {
    mockUseAISettings.mockReturnValue({
      settings: { providers: {}, recentlyUsedModels: [] },
      isConfigured: false,
      updateSettings: vi.fn(),
      addProvider: vi.fn(),
      removeProvider: vi.fn(),
      updateProvider: vi.fn(),
      addRecentlyUsedModel: vi.fn(),
    });

    const { result } = renderHook(() => useAIProjectId());

    expect(result.current.isConfigured).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('should throw error when trying to generate ID without configuration', async () => {
    mockUseAISettings.mockReturnValue({
      settings: { providers: {}, recentlyUsedModels: [] },
      isConfigured: false,
      updateSettings: vi.fn(),
      addProvider: vi.fn(),
      removeProvider: vi.fn(),
      updateProvider: vi.fn(),
      addRecentlyUsedModel: vi.fn(),
    });

    const { result } = renderHook(() => useAIProjectId());

    await expect(result.current.generateProjectId('test prompt')).rejects.toThrow(
      'AI settings not configured'
    );
  });

  it('should throw error when prompt is empty', async () => {
    mockUseAISettings.mockReturnValue({
      settings: {
        providers: {
          openai: { apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
        },
        recentlyUsedModels: []
      },
      isConfigured: true,
      updateSettings: vi.fn(),
      addProvider: vi.fn(),
      removeProvider: vi.fn(),
      updateProvider: vi.fn(),
      addRecentlyUsedModel: vi.fn(),
    });

    const { result } = renderHook(() => useAIProjectId());

    await expect(result.current.generateProjectId('')).rejects.toThrow(
      'Prompt cannot be empty'
    );
  });

  it('should have configured status when providers are available', () => {
    mockUseAISettings.mockReturnValue({
      settings: {
        providers: {
          openai: { apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
        },
        recentlyUsedModels: []
      },
      isConfigured: true,
      updateSettings: vi.fn(),
      addProvider: vi.fn(),
      removeProvider: vi.fn(),
      updateProvider: vi.fn(),
      addRecentlyUsedModel: vi.fn(),
    });

    const { result } = renderHook(() => useAIProjectId());

    expect(result.current.isConfigured).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });
});