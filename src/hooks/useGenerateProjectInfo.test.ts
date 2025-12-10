import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGenerateProjectInfo } from './useGenerateProjectInfo';
import { useAISettings } from './useAISettings';
import { useCurrentUser } from './useCurrentUser';
import { useAppContext } from './useAppContext';
import { useProjectsManager } from './useProjectsManager';
import { createAIClient } from '@/lib/ai-client';
import { parseProviderModel } from '@/lib/parseProviderModel';
import type { ProjectsManager } from '@/lib/ProjectsManager';
import type { ProjectTemplate } from '@/contexts/AppContext';

// Mock the hooks and dependencies
vi.mock('./useAISettings');
vi.mock('./useCurrentUser');
vi.mock('./useAppContext');
vi.mock('./useProjectsManager');
vi.mock('@/lib/ai-client');
vi.mock('@/lib/parseProviderModel');

describe('useGenerateProjectInfo', () => {
  const mockUseAISettings = vi.mocked(useAISettings);
  const mockUseCurrentUser = vi.mocked(useCurrentUser);
  const mockUseAppContext = vi.mocked(useAppContext);
  const mockUseProjectsManager = vi.mocked(useProjectsManager);
  const mockCreateAIClient = vi.mocked(createAIClient);
  const mockParseProviderModel = vi.mocked(parseProviderModel);

  const defaultTemplates: ProjectTemplate[] = [
    {
      name: "MKStack",
      description: "Build Nostr clients with React.",
      url: "https://gitlab.com/soapbox-pub/mkstack.git"
    },
    {
      name: "VanillaJS",
      description: "Simple vanilla JavaScript template.",
      url: "https://github.com/example/vanilla-template.git"
    }
  ];

  let mockGetProject: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetch globally
    global.fetch = vi.fn();

    // Mock useCurrentUser to return undefined user by default
    mockUseCurrentUser.mockReturnValue({
      user: undefined,
      users: [],
    });

    // Mock useAppContext
    const config = {
      theme: 'dark' as const,
      relayMetadata: {
        relays: [{ url: 'wss://relay.damus.io', read: true, write: true }],
        updatedAt: 0,
      },
      templates: defaultTemplates,
      esmUrl: 'https://esm.sh',
      corsProxy: 'https://proxy.example.com/{href}',
      faviconUrl: 'https://external-content.duckduckgo.com/ip3/{hostname}.ico',
      previewDomain: 'local-shakespeare.dev',
      showcaseEnabled: true,
      showcaseModerator: 'npub1jvnpg4c6ljadf5t6ry0w9q0rnm4mksde87kglkrc993z46c39axsgq89sc',
      ngitServers: ['git.shakespeare.diy', 'relay.ngit.dev'],
      fsPathProjects: '/projects',
      fsPathConfig: '/config',
      fsPathTmp: '/tmp',
      fsPathPlugins: '/plugins',
      fsPathTemplates: '/templates',
      sentryDsn: '',
      sentryEnabled: false,
      communityFollowPack: '',
    };
    mockUseAppContext.mockReturnValue({
      config,
      defaultConfig: config,
      updateConfig: vi.fn(),
    });

    // Mock useProjectsManager
    mockGetProject = vi.fn().mockResolvedValue(null);
    const mockProjectsManager = {
      getProject: mockGetProject,
    } as unknown as ProjectsManager;
    mockUseProjectsManager.mockReturnValue(mockProjectsManager);

    // Mock parseProviderModel
    mockParseProviderModel.mockReturnValue({
      provider: { id: 'openai', name: 'OpenAI', apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' },
      model: 'gpt-4',
    });

    // Mock createAIClient
    const mockCompletion = {
      choices: [{
        message: {
          tool_calls: [{
            type: 'function' as const,
            function: {
              name: 'create_project',
              arguments: JSON.stringify({
                project_name: 'test-project-name',
                template_url: 'https://gitlab.com/soapbox-pub/mkstack.git'
              })
            }
          }]
        }
      }]
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
      settings: { providers: [], recentlyUsedModels: [], mcpServers: {} },
      isConfigured: false,
      updateSettings: vi.fn(),
      setProvider: vi.fn(),
      removeProvider: vi.fn(),
      setProviders: vi.fn(),
      addRecentlyUsedModel: vi.fn(),
      setMCPServer: vi.fn(),
      removeMCPServer: vi.fn(),
    });

    const { result } = renderHook(() => useGenerateProjectInfo());

    expect(result.current.isConfigured).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('should throw error when trying to generate without configuration', async () => {
    mockUseAISettings.mockReturnValue({
      settings: { providers: [], recentlyUsedModels: [], mcpServers: {} },
      isConfigured: false,
      updateSettings: vi.fn(),
      setProvider: vi.fn(),
      removeProvider: vi.fn(),
      setProviders: vi.fn(),
      addRecentlyUsedModel: vi.fn(),
      setMCPServer: vi.fn(),
      removeMCPServer: vi.fn(),
    });

    const { result } = renderHook(() => useGenerateProjectInfo());

    await expect(result.current.generateProjectInfo('openai/gpt-4', 'test prompt')).rejects.toThrow(
      'AI settings not configured'
    );
  });

  it('should throw error when prompt is empty', async () => {
    mockUseAISettings.mockReturnValue({
      settings: {
        providers: [
          { id: 'openai', name: 'OpenAI', apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
        ],
        recentlyUsedModels: [],
        mcpServers: {}
      },
      isConfigured: true,
      updateSettings: vi.fn(),
      setProvider: vi.fn(),
      removeProvider: vi.fn(),
      setProviders: vi.fn(),
      addRecentlyUsedModel: vi.fn(),
      setMCPServer: vi.fn(),
      removeMCPServer: vi.fn(),
    });

    const { result } = renderHook(() => useGenerateProjectInfo());

    await expect(result.current.generateProjectInfo('openai/gpt-4', '')).rejects.toThrow(
      'Prompt cannot be empty'
    );
  });

  it('should throw error when no templates are configured', async () => {
    mockUseAISettings.mockReturnValue({
      settings: {
        providers: [
          { id: 'openai', name: 'OpenAI', apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
        ],
        recentlyUsedModels: [],
        mcpServers: {}
      },
      isConfigured: true,
      updateSettings: vi.fn(),
      setProvider: vi.fn(),
      removeProvider: vi.fn(),
      setProviders: vi.fn(),
      addRecentlyUsedModel: vi.fn(),
      setMCPServer: vi.fn(),
      removeMCPServer: vi.fn(),
    });

    // Mock config with no templates
    const config = {
      theme: 'dark' as const,
      relayMetadata: {
        relays: [{ url: 'wss://relay.damus.io', read: true, write: true }],
        updatedAt: 0,
      },
      templates: [],
      esmUrl: 'https://esm.sh',
      corsProxy: 'https://proxy.example.com/{href}',
      faviconUrl: 'https://external-content.duckduckgo.com/ip3/{hostname}.ico',
      previewDomain: 'local-shakespeare.dev',
      showcaseEnabled: true,
      showcaseModerator: 'npub1jvnpg4c6ljadf5t6ry0w9q0rnm4mksde87kglkrc993z46c39axsgq89sc',
      ngitServers: ['git.shakespeare.diy', 'relay.ngit.dev'],
      fsPathProjects: '/projects',
      fsPathConfig: '/config',
      fsPathTmp: '/tmp',
      fsPathPlugins: '/plugins',
      fsPathTemplates: '/templates',
      sentryDsn: '',
      sentryEnabled: false,
      communityFollowPack: '',
    };
    mockUseAppContext.mockReturnValue({
      config,
      defaultConfig: config,
      updateConfig: vi.fn(),
    });

    const { result } = renderHook(() => useGenerateProjectInfo());

    await expect(result.current.generateProjectInfo('openai/gpt-4', 'test prompt')).rejects.toThrow(
      'No templates configured'
    );
  });

  it('should successfully generate project info with template selection', async () => {
    mockUseAISettings.mockReturnValue({
      settings: {
        providers: [
          { id: 'openai', name: 'OpenAI', apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
        ],
        recentlyUsedModels: [],
        mcpServers: {}
      },
      isConfigured: true,
      updateSettings: vi.fn(),
      setProvider: vi.fn(),
      removeProvider: vi.fn(),
      setProviders: vi.fn(),
      addRecentlyUsedModel: vi.fn(),
      setMCPServer: vi.fn(),
      removeMCPServer: vi.fn(),
    });

    const { result } = renderHook(() => useGenerateProjectInfo());

    const projectInfo = await result.current.generateProjectInfo('openai/gpt-4', 'A social media app for developers');

    expect(projectInfo).toEqual({
      projectId: 'test-project-name',
      template: {
        name: 'MKStack',
        description: 'Build Nostr clients with React.',
        url: 'https://gitlab.com/soapbox-pub/mkstack.git'
      }
    });
    expect(mockParseProviderModel).toHaveBeenCalledWith('openai/gpt-4', [
      { id: 'openai', name: 'OpenAI', apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
    ]);
    expect(mockCreateAIClient).toHaveBeenCalledWith(
      { id: 'openai', name: 'OpenAI', apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' },
      undefined,
      'https://proxy.example.com/{href}'
    );
  });

  it('should fallback to first template when AI selects invalid template URL', async () => {
    mockUseAISettings.mockReturnValue({
      settings: {
        providers: [
          { id: 'openai', name: 'OpenAI', apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
        ],
        recentlyUsedModels: [],
        mcpServers: {}
      },
      isConfigured: true,
      updateSettings: vi.fn(),
      setProvider: vi.fn(),
      removeProvider: vi.fn(),
      setProviders: vi.fn(),
      addRecentlyUsedModel: vi.fn(),
      setMCPServer: vi.fn(),
      removeMCPServer: vi.fn(),
    });

    // Mock AI to return invalid template URL
    const mockCompletion = {
      choices: [{
        message: {
          tool_calls: [{
            type: 'function' as const,
            function: {
              name: 'create_project',
              arguments: JSON.stringify({
                project_name: 'test-project',
                template_url: 'https://invalid-url.com/template.git'
              })
            }
          }]
        }
      }]
    };
    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(mockCompletion)
        }
      }
    } as unknown as ReturnType<typeof createAIClient>;
    mockCreateAIClient.mockReturnValue(mockOpenAI);

    const { result } = renderHook(() => useGenerateProjectInfo());

    const projectInfo = await result.current.generateProjectInfo('openai/gpt-4', 'test prompt');

    expect(projectInfo.template.url).toBe('https://gitlab.com/soapbox-pub/mkstack.git');
    expect(projectInfo.projectId).toBe('untitled');
  });

  it('should increment AI-generated ID when project already exists', async () => {
    mockUseAISettings.mockReturnValue({
      settings: {
        providers: [
          { id: 'openai', name: 'OpenAI', apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
        ],
        recentlyUsedModels: [],
        mcpServers: {}
      },
      isConfigured: true,
      updateSettings: vi.fn(),
      setProvider: vi.fn(),
      removeProvider: vi.fn(),
      setProviders: vi.fn(),
      addRecentlyUsedModel: vi.fn(),
      setMCPServer: vi.fn(),
      removeMCPServer: vi.fn(),
    });

    // Reset and override the mock to return project on first call, null on second
    mockGetProject.mockReset();
    mockGetProject
      .mockResolvedValueOnce({ id: 'test-project-name', name: 'Test Project', path: '/projects/test-project-name', lastModified: new Date() })
      .mockResolvedValue(null);

    const { result } = renderHook(() => useGenerateProjectInfo());

    const projectInfo = await result.current.generateProjectInfo('openai/gpt-4', 'test prompt');

    expect(projectInfo.projectId).toBe('test-project-name-1');
    expect(projectInfo.template.url).toBe('https://gitlab.com/soapbox-pub/mkstack.git');
    expect(mockGetProject).toHaveBeenCalledTimes(2);
    expect(mockGetProject).toHaveBeenNthCalledWith(1, 'test-project-name');
    expect(mockGetProject).toHaveBeenNthCalledWith(2, 'test-project-name-1');
  });

  it('should increment multiple times when necessary', async () => {
    mockUseAISettings.mockReturnValue({
      settings: {
        providers: [
          { id: 'openai', name: 'OpenAI', apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
        ],
        recentlyUsedModels: [],
        mcpServers: {}
      },
      isConfigured: true,
      updateSettings: vi.fn(),
      setProvider: vi.fn(),
      removeProvider: vi.fn(),
      setProviders: vi.fn(),
      addRecentlyUsedModel: vi.fn(),
      setMCPServer: vi.fn(),
      removeMCPServer: vi.fn(),
    });

    // Reset and override the mock - base and -1 exist, -2 is available
    mockGetProject.mockReset();
    mockGetProject
      .mockResolvedValueOnce({ id: 'test-project-name', name: 'Test Project', path: '/projects/test-project-name', lastModified: new Date() })
      .mockResolvedValueOnce({ id: 'test-project-name-1', name: 'Test Project 1', path: '/projects/test-project-name-1', lastModified: new Date() })
      .mockResolvedValue(null);

    const { result } = renderHook(() => useGenerateProjectInfo());

    const projectInfo = await result.current.generateProjectInfo('openai/gpt-4', 'test prompt');

    expect(projectInfo.projectId).toBe('test-project-name-2');
    expect(projectInfo.template.url).toBe('https://gitlab.com/soapbox-pub/mkstack.git');
    expect(mockGetProject).toHaveBeenCalledTimes(3);
    expect(mockGetProject).toHaveBeenNthCalledWith(1, 'test-project-name');
    expect(mockGetProject).toHaveBeenNthCalledWith(2, 'test-project-name-1');
    expect(mockGetProject).toHaveBeenNthCalledWith(3, 'test-project-name-2');
  });

  it('should handle loading state correctly', async () => {
    mockUseAISettings.mockReturnValue({
      settings: {
        providers: [
          { id: 'openai', name: 'OpenAI', apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
        ],
        recentlyUsedModels: [],
        mcpServers: {}
      },
      isConfigured: true,
      updateSettings: vi.fn(),
      setProvider: vi.fn(),
      removeProvider: vi.fn(),
      setProviders: vi.fn(),
      addRecentlyUsedModel: vi.fn(),
      setMCPServer: vi.fn(),
      removeMCPServer: vi.fn(),
    });

    const { result } = renderHook(() => useGenerateProjectInfo());

    expect(result.current.isLoading).toBe(false);

    const promise = result.current.generateProjectInfo('openai/gpt-4', 'Test prompt');

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false); // Should be false after completion
    });

    await promise;
  });

  it('should select second template when AI chooses it', async () => {
    mockUseAISettings.mockReturnValue({
      settings: {
        providers: [
          { id: 'openai', name: 'OpenAI', apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' }
        ],
        recentlyUsedModels: [],
        mcpServers: {}
      },
      isConfigured: true,
      updateSettings: vi.fn(),
      setProvider: vi.fn(),
      removeProvider: vi.fn(),
      setProviders: vi.fn(),
      addRecentlyUsedModel: vi.fn(),
      setMCPServer: vi.fn(),
      removeMCPServer: vi.fn(),
    });

    // Mock AI to select the second template
    const mockCompletion = {
      choices: [{
        message: {
          tool_calls: [{
            type: 'function' as const,
            function: {
              name: 'create_project',
              arguments: JSON.stringify({
                project_name: 'vanilla-app',
                template_url: 'https://github.com/example/vanilla-template.git'
              })
            }
          }]
        }
      }]
    };
    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(mockCompletion)
        }
      }
    } as unknown as ReturnType<typeof createAIClient>;
    mockCreateAIClient.mockReturnValue(mockOpenAI);

    const { result } = renderHook(() => useGenerateProjectInfo());

    const projectInfo = await result.current.generateProjectInfo('openai/gpt-4', 'A simple vanilla JS app');

    expect(projectInfo).toEqual({
      projectId: 'vanilla-app',
      template: {
        name: 'VanillaJS',
        description: 'Simple vanilla JavaScript template.',
        url: 'https://github.com/example/vanilla-template.git'
      }
    });
  });
});
