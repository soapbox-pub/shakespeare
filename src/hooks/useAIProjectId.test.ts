import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAIProjectId } from './useAIProjectId';
import { useAISettings } from './useAISettings';
import { useCurrentUser } from './useCurrentUser';
import { useProjectsManager } from './useProjectsManager';
import { createAIClient } from '@/lib/ai-client';
import { parseProviderModel } from '@/lib/parseProviderModel';
import type { ProjectsManager } from '@/lib/ProjectsManager';

// Mock the hooks and dependencies
vi.mock('./useAISettings');
vi.mock('./useCurrentUser');
vi.mock('./useProjectsManager');
vi.mock('@/lib/ai-client');
vi.mock('@/lib/parseProviderModel');

describe('useAIProjectId', () => {
  const mockUseAISettings = vi.mocked(useAISettings);
  const mockUseCurrentUser = vi.mocked(useCurrentUser);
  const mockUseProjectsManager = vi.mocked(useProjectsManager);
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

    // Mock useProjectsManager
    const mockProjectsManager = {
      getProject: vi.fn().mockResolvedValue(null),
    } as unknown as ProjectsManager;
    mockUseProjectsManager.mockReturnValue(mockProjectsManager);

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

  it('should retry with new names when project exists', async () => {
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

    // Mock multiple responses - first one exists, second one is unique
    const mockCompletion1 = {
      choices: [{ message: { content: 'existing-project' } }]
    };
    const mockCompletion2 = {
      choices: [{ message: { content: 'unique-project' } }]
    };
    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn()
            .mockResolvedValueOnce(mockCompletion1)
            .mockResolvedValueOnce(mockCompletion2)
        }
      }
    } as unknown as ReturnType<typeof createAIClient>;
    mockCreateAIClient.mockReturnValue(mockOpenAI);

    // Mock getProject - first call returns project (exists), second returns null (unique)
    const mockGetProject = vi.fn()
      .mockResolvedValueOnce({ id: 'existing-project', name: 'Existing Project', path: '/projects/existing-project', lastModified: new Date() })
      .mockResolvedValueOnce(null);

    const mockProjectsManager = {
      getProject: mockGetProject,
    } as unknown as ProjectsManager;
    mockUseProjectsManager.mockReturnValue(mockProjectsManager);

    const { result } = renderHook(() => useAIProjectId());

    const projectId = await result.current.generateProjectId('openai/gpt-4', 'A social media app for developers');

    expect(projectId).toBe('unique-project');
    expect(mockGetProject).toHaveBeenCalledTimes(2);
    expect(mockGetProject).toHaveBeenNthCalledWith(1, 'existing-project');
    expect(mockGetProject).toHaveBeenNthCalledWith(2, 'unique-project');

    // Should have called AI twice - once for initial name, once for retry
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);

    // Second call should include the "already taken" message
    const mockCreate = mockOpenAI.chat.completions.create as ReturnType<typeof vi.fn>;
    const secondCallArgs = mockCreate.mock.calls[1][0];
    expect(secondCallArgs.messages).toHaveLength(3);
    expect(secondCallArgs.messages[2].content).toContain('already taken');
  });

  it('should throw error after maximum iterations', async () => {
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

    // Mock AI to always return the same name
    const mockCompletion = {
      choices: [{ message: { content: 'taken-project' } }]
    };
    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(mockCompletion)
        }
      }
    } as unknown as ReturnType<typeof createAIClient>;
    mockCreateAIClient.mockReturnValue(mockOpenAI);

    // Mock getProject to always return a project (project always exists)
    const mockGetProject = vi.fn().mockResolvedValue({
      id: 'taken-project',
      name: 'Taken Project',
      path: '/projects/taken-project',
      lastModified: new Date()
    });

    const mockProjectsManager = {
      getProject: mockGetProject,
    } as unknown as ProjectsManager;
    mockUseProjectsManager.mockReturnValue(mockProjectsManager);

    const { result } = renderHook(() => useAIProjectId());

    await expect(result.current.generateProjectId('openai/gpt-4', 'A social media app for developers'))
      .rejects.toThrow('Failed to generate a unique project name after 3 attempts');

    expect(mockGetProject).toHaveBeenCalledTimes(3);
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(3);
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