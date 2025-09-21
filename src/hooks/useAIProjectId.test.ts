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
      settings: { providers: [], recentlyUsedModels: [] },
      isConfigured: false,
      updateSettings: vi.fn(),
      setProvider: vi.fn(),
      removeProvider: vi.fn(),
      setProviders: vi.fn(),
      addRecentlyUsedModel: vi.fn(),
    });

    const { result } = renderHook(() => useAIProjectId());

    expect(result.current.isConfigured).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('should throw error when trying to generate ID without configuration', async () => {
    mockUseAISettings.mockReturnValue({
      settings: { providers: [], recentlyUsedModels: [] },
      isConfigured: false,
      updateSettings: vi.fn(),
      setProvider: vi.fn(),
      removeProvider: vi.fn(),
      setProviders: vi.fn(),
      
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
        providers: [
          { id: 'openai', apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
        ],
        recentlyUsedModels: []
      },
      isConfigured: true,
      updateSettings: vi.fn(),
      setProvider: vi.fn(),
      removeProvider: vi.fn(),
      setProviders: vi.fn(),
      
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
        providers: [
          { id: 'openai', apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
        ],
        recentlyUsedModels: []
      },
      isConfigured: true,
      updateSettings: vi.fn(),
      setProvider: vi.fn(),
      removeProvider: vi.fn(),
      setProviders: vi.fn(),
      
      addRecentlyUsedModel: vi.fn(),
    });

    const { result } = renderHook(() => useAIProjectId());

    expect(result.current.isConfigured).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('should successfully generate project ID', async () => {
    mockUseAISettings.mockReturnValue({
      settings: {
        providers: [
          { id: 'openai', apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
        ],
        recentlyUsedModels: []
      },
      isConfigured: true,
      updateSettings: vi.fn(),
      setProvider: vi.fn(),
      removeProvider: vi.fn(),
      setProviders: vi.fn(),
      
      addRecentlyUsedModel: vi.fn(),
    });

    const { result } = renderHook(() => useAIProjectId());

    const projectId = await result.current.generateProjectId('openai/gpt-4', 'A social media app for developers');

    expect(projectId).toBe('test-project-name');
    expect(mockParseProviderModel).toHaveBeenCalledWith('openai/gpt-4', [
      { id: 'openai', apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
    ]);
    expect(mockCreateAIClient).toHaveBeenCalledWith(
      { apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' },
      undefined
    );
  });

  it('should fallback to untitled when project exists', async () => {
    mockUseAISettings.mockReturnValue({
      settings: {
        providers: [
          { id: 'openai', apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
        ],
        recentlyUsedModels: []
      },
      isConfigured: true,
      updateSettings: vi.fn(),
      setProvider: vi.fn(),
      removeProvider: vi.fn(),
      setProviders: vi.fn(),
      
      addRecentlyUsedModel: vi.fn(),
    });

    // Mock AI response - returns a project name that already exists
    const mockCompletion = {
      choices: [{ message: { content: 'existing-project' } }]
    };
    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValueOnce(mockCompletion)
        }
      }
    } as unknown as ReturnType<typeof createAIClient>;
    mockCreateAIClient.mockReturnValue(mockOpenAI);

    // Mock getProject - first call returns project (exists), second returns null (untitled is available)
    const mockGetProject = vi.fn()
      .mockResolvedValueOnce({ id: 'existing-project', name: 'Existing Project', path: '/projects/existing-project', lastModified: new Date() })
      .mockResolvedValueOnce(null);

    const mockProjectsManager = {
      getProject: mockGetProject,
    } as unknown as ProjectsManager;
    mockUseProjectsManager.mockReturnValue(mockProjectsManager);

    const { result } = renderHook(() => useAIProjectId());

    const projectId = await result.current.generateProjectId('openai/gpt-4', 'A social media app for developers');

    expect(projectId).toBe('untitled');
    expect(mockGetProject).toHaveBeenCalledTimes(2);
    expect(mockGetProject).toHaveBeenNthCalledWith(1, 'existing-project');
    expect(mockGetProject).toHaveBeenNthCalledWith(2, 'untitled');

    // Should have called AI only once
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
  });

  it('should fallback to untitled-1 when untitled exists', async () => {
    mockUseAISettings.mockReturnValue({
      settings: {
        providers: [
          { id: 'openai', apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
        ],
        recentlyUsedModels: []
      },
      isConfigured: true,
      updateSettings: vi.fn(),
      setProvider: vi.fn(),
      removeProvider: vi.fn(),
      setProviders: vi.fn(),
      
      addRecentlyUsedModel: vi.fn(),
    });

    // Mock AI to return a project name that already exists
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

    // Mock getProject - taken-project exists, untitled exists, untitled-1 is available
    const mockGetProject = vi.fn()
      .mockResolvedValueOnce({ id: 'taken-project', name: 'Taken Project', path: '/projects/taken-project', lastModified: new Date() })
      .mockResolvedValueOnce({ id: 'untitled', name: 'Untitled', path: '/projects/untitled', lastModified: new Date() })
      .mockResolvedValueOnce(null);

    const mockProjectsManager = {
      getProject: mockGetProject,
    } as unknown as ProjectsManager;
    mockUseProjectsManager.mockReturnValue(mockProjectsManager);

    const { result } = renderHook(() => useAIProjectId());

    const projectId = await result.current.generateProjectId('openai/gpt-4', 'A social media app for developers');

    expect(projectId).toBe('untitled-1');
    expect(mockGetProject).toHaveBeenCalledTimes(3);
    expect(mockGetProject).toHaveBeenNthCalledWith(1, 'taken-project');
    expect(mockGetProject).toHaveBeenNthCalledWith(2, 'untitled');
    expect(mockGetProject).toHaveBeenNthCalledWith(3, 'untitled-1');

    // Should have called AI only once
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
  });

  it('should fallback to untitled when AI generates too long name', async () => {
    mockUseAISettings.mockReturnValue({
      settings: {
        providers: [
          { id: 'openai', apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
        ],
        recentlyUsedModels: []
      },
      isConfigured: true,
      updateSettings: vi.fn(),
      setProvider: vi.fn(),
      removeProvider: vi.fn(),
      setProviders: vi.fn(),
      
      addRecentlyUsedModel: vi.fn(),
    });

    // Mock AI to return a very long project name (over 50 characters)
    const mockCompletion = {
      choices: [{ message: { content: 'this-is-a-very-long-project-name-that-exceeds-the-maximum-allowed-length-limit' } }]
    };
    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(mockCompletion)
        }
      }
    } as unknown as ReturnType<typeof createAIClient>;
    mockCreateAIClient.mockReturnValue(mockOpenAI);

    // Mock getProject - untitled is available
    const mockGetProject = vi.fn().mockResolvedValue(null);

    const mockProjectsManager = {
      getProject: mockGetProject,
    } as unknown as ProjectsManager;
    mockUseProjectsManager.mockReturnValue(mockProjectsManager);

    const { result } = renderHook(() => useAIProjectId());

    const projectId = await result.current.generateProjectId('openai/gpt-4', 'A social media app for developers');

    expect(projectId).toBe('untitled');
    expect(mockGetProject).toHaveBeenCalledTimes(1);
    expect(mockGetProject).toHaveBeenNthCalledWith(1, 'untitled');

    // Should have called AI only once
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
  });

  it('should fallback to untitled when AI generates invalid name', async () => {
    mockUseAISettings.mockReturnValue({
      settings: {
        providers: [
          { id: 'openai', apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
        ],
        recentlyUsedModels: []
      },
      isConfigured: true,
      updateSettings: vi.fn(),
      setProvider: vi.fn(),
      removeProvider: vi.fn(),
      setProviders: vi.fn(),
      
      addRecentlyUsedModel: vi.fn(),
    });

    // Mock AI to return an invalid project name (doesn't match regex)
    const mockCompletion = {
      choices: [{ message: { content: 'Invalid Project Name!' } }]
    };
    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(mockCompletion)
        }
      }
    } as unknown as ReturnType<typeof createAIClient>;
    mockCreateAIClient.mockReturnValue(mockOpenAI);

    // Mock getProject - untitled is available
    const mockGetProject = vi.fn().mockResolvedValue(null);

    const mockProjectsManager = {
      getProject: mockGetProject,
    } as unknown as ProjectsManager;
    mockUseProjectsManager.mockReturnValue(mockProjectsManager);

    const { result } = renderHook(() => useAIProjectId());

    const projectId = await result.current.generateProjectId('openai/gpt-4', 'A social media app for developers');

    expect(projectId).toBe('untitled');
    expect(mockGetProject).toHaveBeenCalledTimes(1);
    expect(mockGetProject).toHaveBeenNthCalledWith(1, 'untitled');

    // Should have called AI only once
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
  });

  it('should fallback to untitled-2 when untitled and untitled-1 exist', async () => {
    mockUseAISettings.mockReturnValue({
      settings: {
        providers: [
          { id: 'openai', apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
        ],
        recentlyUsedModels: []
      },
      isConfigured: true,
      updateSettings: vi.fn(),
      setProvider: vi.fn(),
      removeProvider: vi.fn(),
      setProviders: vi.fn(),
      
      addRecentlyUsedModel: vi.fn(),
    });

    // Mock AI to return a project name that already exists
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

    // Mock getProject - taken-project exists, untitled exists, untitled-1 exists, untitled-2 is available
    const mockGetProject = vi.fn()
      .mockResolvedValueOnce({ id: 'taken-project', name: 'Taken Project', path: '/projects/taken-project', lastModified: new Date() })
      .mockResolvedValueOnce({ id: 'untitled', name: 'Untitled', path: '/projects/untitled', lastModified: new Date() })
      .mockResolvedValueOnce({ id: 'untitled-1', name: 'Untitled 1', path: '/projects/untitled-1', lastModified: new Date() })
      .mockResolvedValueOnce(null);

    const mockProjectsManager = {
      getProject: mockGetProject,
    } as unknown as ProjectsManager;
    mockUseProjectsManager.mockReturnValue(mockProjectsManager);

    const { result } = renderHook(() => useAIProjectId());

    const projectId = await result.current.generateProjectId('openai/gpt-4', 'A social media app for developers');

    expect(projectId).toBe('untitled-2');
    expect(mockGetProject).toHaveBeenCalledTimes(4);
    expect(mockGetProject).toHaveBeenNthCalledWith(1, 'taken-project');
    expect(mockGetProject).toHaveBeenNthCalledWith(2, 'untitled');
    expect(mockGetProject).toHaveBeenNthCalledWith(3, 'untitled-1');
    expect(mockGetProject).toHaveBeenNthCalledWith(4, 'untitled-2');

    // Should have called AI only once
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
  });

  it('should handle loading state correctly', async () => {
    mockUseAISettings.mockReturnValue({
      settings: {
        providers: [
          { id: 'openai', apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
        ],
        recentlyUsedModels: []
      },
      isConfigured: true,
      updateSettings: vi.fn(),
      setProvider: vi.fn(),
      removeProvider: vi.fn(),
      setProviders: vi.fn(),
      
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