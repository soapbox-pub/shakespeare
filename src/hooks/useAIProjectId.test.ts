import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAIProjectId } from './useAIProjectId';
import { useAISettings } from './useAISettings';
import { useCurrentUser } from './useCurrentUser';
import { createAIClient } from '@/lib/ai-client';
import { parseProviderModel } from '@/lib/parseProviderModel';

// Mock the hooks and dependencies
vi.mock('./useAISettings');
vi.mock('./useCurrentUser');
vi.mock('@/lib/ai-client');
vi.mock('@/lib/parseProviderModel');

describe('useAIProjectId', () => {
  const mockUseAISettings = vi.mocked(useAISettings);
  const mockUseCurrentUser = vi.mocked(useCurrentUser);
  const mockCreateAIClient = vi.mocked(createAIClient);
  const mockParseProviderModel = vi.mocked(parseProviderModel);

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetch globally
    global.fetch = vi.fn();

    // Mock useCurrentUser to return undefined user by default
    mockUseCurrentUser.mockReturnValue({
      user: undefined,
      users: [],
    });

    // Mock parseProviderModel
    mockParseProviderModel.mockReturnValue({
      provider: 'openai',
      model: 'gpt-4',
      connection: { apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
    });

    // Mock createAIClient
    const mockCompletion = {
      choices: [{ message: { content: 'test-project-name' } }]
    };
    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(mockCompletion)
        }
      }
    } as unknown as ReturnType<typeof createAIClient>;
    mockCreateAIClient.mockReturnValue(mockOpenAI);
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

    await expect(result.current.generateProjectId('openai/gpt-4', 'test prompt')).rejects.toThrow(
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

    await expect(result.current.generateProjectId('openai/gpt-4', '')).rejects.toThrow(
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

  it('should successfully generate project ID', async () => {
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

    const projectId = await result.current.generateProjectId('openai/gpt-4', 'A social media app for developers');

    expect(projectId).toBe('test-project-name');
    expect(mockParseProviderModel).toHaveBeenCalledWith('openai/gpt-4', {
      openai: { apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
    });
    expect(mockCreateAIClient).toHaveBeenCalledWith(
      { apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' },
      undefined
    );
  });

  it('should handle loading state correctly', async () => {
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

    expect(result.current.isLoading).toBe(false);

    const promise = result.current.generateProjectId('openai/gpt-4', 'Test prompt');

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false); // Should be false after completion
    });

    await promise;
  });
});