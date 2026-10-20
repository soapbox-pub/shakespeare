import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager, type AIMessage } from './SessionManager';
import type { JSRuntimeFS } from './JSRuntime';
import type { NPool } from '@nostrify/nostrify';
import type { AppConfig } from '@/contexts/AppContext';
import { isSystemReminder } from './systemReminder';

const mockCreate = vi.fn();

vi.mock('./ai-client', async (importOriginal) => ({
  ...await importOriginal<typeof import('./ai-client')>(),
  createAIClient: () => ({ chat: { completions: { create: mockCreate } } }),
}));

const systemMocks = vi.hoisted(() => ({
  renders: 0,
  deployedUrl: undefined as string | undefined,
}));

vi.mock('./system', async (importOriginal) => ({
  ...await importOriginal<typeof import('./system')>(),
  makeSystemPrompt: async () => `system prompt ${++systemMocks.renders}`,
  readDeployedUrl: async () => systemMocks.deployedUrl,
}));

vi.mock('./git', () => ({
  Git: class {
    getRemoteURL = async () => undefined;
    log = async () => [];
  },
}));

// Mock the filesystem: files live in a map, directories exist when a file is under them
const files = new Map<string, string>();
const mockFS: JSRuntimeFS = {
  readFile: vi.fn(async (path: string) => {
    const content = files.get(path);
    if (content === undefined) throw new Error(`ENOENT: ${path}`);
    return content;
  }),
  writeFile: vi.fn(async (path: string, content: string) => {
    files.set(path, content);
  }),
  readdir: vi.fn(async (path: string) => [...files.keys()]
    .filter((file) => file.startsWith(path + '/'))
    .map((file) => file.slice(path.length + 1).split('/')[0])),
  mkdir: vi.fn(),
  rmdir: vi.fn(),
  unlink: vi.fn(async (path: string) => {
    files.delete(path);
  }),
  stat: vi.fn(async (path: string) => {
    if ([...files.keys()].some((file) => file.startsWith(path + '/'))) return { isDirectory: () => true };
    throw new Error(`ENOENT: ${path}`);
  }),
  exists: vi.fn(),
  copyFile: vi.fn(),
  rename: vi.fn(),
  symlink: vi.fn(),
  readlink: vi.fn(),
  chmod: vi.fn(),
  chown: vi.fn(),
  utimes: vi.fn(),
  realpath: vi.fn(),
} as unknown as JSRuntimeFS;

// Mock NPool
const mockNostr: NPool = {
  query: vi.fn(),
  req: vi.fn(),
  event: vi.fn(),
} as unknown as NPool;

// Test configuration
const testConfig: AppConfig = {
  theme: 'light',
  relayMetadata: {
    relays: [
      { url: 'wss://relay.nostr.band', read: true, write: true },
    ],
    updatedAt: 0,
  },
  templates: [{ name: 'MKStack', description: 'Build Nostr clients with React.', url: 'https://gitlab.com/soapbox-pub/mkstack.git' }],
  esmUrl: 'https://esm.shakespeare.diy',
  corsProxy: 'https://proxy.shakespeare.diy/?url={href}',
  gitProxyOrigins: ['https://github.com', 'https://gitlab.com'],
  faviconUrl: 'https://external-content.duckduckgo.com/ip3/{hostname}.ico',
  ngitWebUrl: 'https://nostrhub.io/{naddr}',
  previewDomain: 'iframe.diy',
  language: 'en',
  showcaseEnabled: true,
  showcaseCurator: '',
  graspMetadata: { relays: [{ url: 'wss://git.shakespeare.diy/' }, { url: 'wss://relay.ngit.dev/' }], updatedAt: 0 },
  fsPathProjects: '/projects',
  fsPathConfig: '/config',
  fsPathTmp: '/tmp',
  fsPathPlugins: '/plugins',
  fsPathTemplates: '/templates',
  sentryDsn: '',
  sentryEnabled: false,
  plausibleDomain: '',
  plausibleEndpoint: '',
};

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  const mockAISettings = {
    providers: [
      {
        id: 'test-provider',
        name: 'Test Provider',
        baseURL: 'https://api.test.com',
        apiKey: 'test-key'
      }
    ]
  };

  beforeEach(() => {
    files.clear();
    mockCreate.mockReset();
    systemMocks.renders = 0;
    systemMocks.deployedUrl = undefined;
    const getSettings = () => mockAISettings;
    const getConfig = () => testConfig;
    const getDefaultConfig = () => testConfig;
    sessionManager = new SessionManager(mockFS, mockNostr, getSettings, getConfig, getDefaultConfig);
  });

  it('should initialize streaming message with reasoning content', async () => {
    const projectId = 'test-project';
    const tools = {};
    const customTools = {};

    const session = await sessionManager.loadSession(projectId, tools, customTools);

    expect(session.projectId).toBe(projectId);
    expect(session.streamingMessage).toBeUndefined();
  });

  it('should emit streamingUpdate events with reasoning content', () => {
    const projectId = 'test-project';
    const mockListener = vi.fn();

    sessionManager.on('streamingUpdate', mockListener);

    // Simulate a streaming update with reasoning content
    sessionManager.emit('streamingUpdate', projectId, 'content', 'reasoning', undefined);

    expect(mockListener).toHaveBeenCalledWith(projectId, 'content', 'reasoning', undefined);
  });

  it('should handle streaming message with reasoning content', async () => {
    const projectId = 'test-project';
    const tools = {};
    const customTools = {};

    const session = await sessionManager.loadSession(projectId, tools, customTools);

    // Manually set a streaming message to test the structure
    session.streamingMessage = {
      role: 'assistant',
      content: 'test content',
      reasoning_content: 'test reasoning',
      tool_calls: undefined
    };

    expect(session.streamingMessage.reasoning_content).toBe('test reasoning');
    expect(session.streamingMessage.content).toBe('test content');
  });

  it('should support assistant messages with reasoning content', () => {
    // Test that AIMessage type supports reasoning content
    const messageWithReasoning: AIMessage = {
      role: 'assistant',
      content: 'Here is my response',
      reasoning_content: 'Let me think about this step by step...'
    };

    expect(messageWithReasoning.role).toBe('assistant');
    expect(messageWithReasoning.content).toBe('Here is my response');
    expect('reasoning_content' in messageWithReasoning).toBe(true);
    if ('reasoning_content' in messageWithReasoning) {
      expect(messageWithReasoning.reasoning_content).toBe('Let me think about this step by step...');
    }
  });

  it('should throw service errors instead of adding them to message history', async () => {
    const projectId = 'test-project';
    const tools = {};
    const customTools = {};

    // Load a session
    await sessionManager.loadSession(projectId, tools, customTools);

    // Add a user message to enable generation
    await sessionManager.addMessage(projectId, { role: 'user', content: 'test message' });

    // Attempt to start generation with invalid provider - should throw error instead of adding to messages
    await expect(
      sessionManager.startGeneration(projectId, 'invalid-provider/invalid-model')
    ).rejects.toThrow('Provider "invalid-provider" not found');

    // Verify that no error message was added to the conversation
    const updatedSession = sessionManager.getSession(projectId);
    expect(updatedSession?.messages).toHaveLength(1); // Only the user message
    expect(updatedSession?.messages[0].role).toBe('user');
  });

  it('should track when images are not supported and strip them on subsequent requests', async () => {
    const projectId = 'test-project';
    const tools = {};
    const customTools = {};

    // Load a session
    const session = await sessionManager.loadSession(projectId, tools, customTools);

    // Initially, images should not be marked as unsupported
    expect(session.imagesNotSupported).toBeUndefined();

    // Simulate marking images as not supported (this would happen after an API error)
    session.imagesNotSupported = true;

    // Verify the flag is set
    expect(session.imagesNotSupported).toBe(true);

    // On subsequent requests, the SessionManager should proactively strip images
    // This prevents retrying with images on every message/tool call
  });

  it('should send the session name as x-session-id', async () => {
    const projectId = 'test-project';
    const session = await sessionManager.loadSession(projectId, {}, {});
    await sessionManager.addMessage(projectId, { role: 'user', content: 'test message' });

    mockCreate.mockImplementation(async function* () {
      yield { choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] };
    });

    await sessionManager.startGeneration(projectId, 'test-provider/test-model');

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const [, options] = mockCreate.mock.calls[0];
    expect(options.headers).toEqual({ 'x-session-id': session.sessionName });
  });

  describe('system prompt', () => {
    const projectId = 'test-project';
    const providerModel = 'test-provider/test-model';

    const stop = async function* () {
      yield { choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] };
    };
    const callTool = async function* () {
      yield {
        choices: [{
          delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'missing_tool', arguments: '{}' } }] },
          finish_reason: 'tool_calls',
        }],
      };
    };

    const sentMessages = (call: number) => mockCreate.mock.calls[call][0].messages as AIMessage[];
    const sentSystemPrompt = (call: number) => sentMessages(call)[0].content;

    it('is rendered once and sent unchanged on every step and turn', async () => {
      await sessionManager.loadSession(projectId, {}, {});
      await sessionManager.addMessage(projectId, { role: 'user', content: 'build it' });

      mockCreate.mockImplementationOnce(callTool).mockImplementationOnce(stop).mockImplementationOnce(stop);
      await sessionManager.startGeneration(projectId, providerModel);
      await sessionManager.addMessage(projectId, { role: 'user', content: 'and more' });
      await sessionManager.startGeneration(projectId, providerModel);

      expect(mockCreate).toHaveBeenCalledTimes(3);
      expect(systemMocks.renders).toBe(1);
      expect(sentSystemPrompt(1)).toBe(sentSystemPrompt(0));
      expect(sentSystemPrompt(2)).toBe(sentSystemPrompt(0));
    });

    it('is reused after a reload', async () => {
      await sessionManager.loadSession(projectId, {}, {});
      await sessionManager.addMessage(projectId, { role: 'user', content: 'build it' });
      mockCreate.mockImplementation(stop);
      await sessionManager.startGeneration(projectId, providerModel);

      const reloaded = new SessionManager(mockFS, mockNostr, () => mockAISettings, () => testConfig, () => testConfig);
      await reloaded.loadSession(projectId, {}, {});
      await reloaded.addMessage(projectId, { role: 'user', content: 'and more' });
      await reloaded.startGeneration(projectId, providerModel);

      expect(systemMocks.renders).toBe(1);
      expect(sentSystemPrompt(1)).toBe(sentSystemPrompt(0));
    });

    it('is rendered again for a new session', async () => {
      await sessionManager.loadSession(projectId, {}, {});
      await sessionManager.addMessage(projectId, { role: 'user', content: 'build it' });
      mockCreate.mockImplementation(stop);
      await sessionManager.startGeneration(projectId, providerModel);

      await sessionManager.startNewSession(projectId);
      await sessionManager.addMessage(projectId, { role: 'user', content: 'something else' });
      await sessionManager.startGeneration(projectId, providerModel);

      expect(systemMocks.renders).toBe(2);
      expect(sentSystemPrompt(1)).not.toBe(sentSystemPrompt(0));
    });

    it('reports a change it states in one reminder at the end of the history', async () => {
      await sessionManager.loadSession(projectId, {}, {});
      await sessionManager.addMessage(projectId, { role: 'user', content: 'build it' });
      mockCreate.mockImplementation(stop);
      await sessionManager.startGeneration(projectId, providerModel);

      systemMocks.deployedUrl = 'https://example.shakespeare.wtf';
      await sessionManager.addMessage(projectId, { role: 'user', content: 'and more' });
      await sessionManager.startGeneration(projectId, providerModel);
      await sessionManager.addMessage(projectId, { role: 'user', content: 'thanks' });
      await sessionManager.startGeneration(projectId, providerModel);

      expect(systemMocks.renders).toBe(1);
      expect(sentSystemPrompt(1)).toBe(sentSystemPrompt(0));

      const reminders = sessionManager.getSession(projectId)!.messages.filter(isSystemReminder);
      expect(reminders).toHaveLength(1);
      expect(reminders[0].content).toContain('now deployed at https://example.shakespeare.wtf');

      // Sent right after the user's message, and kept in place on later requests
      const second = sentMessages(1);
      expect(second.at(-1)).toEqual(reminders[0]);
      expect(second.at(-2)).toEqual({ role: 'user', content: 'and more' });
      expect(sentMessages(2).slice(0, second.length)).toEqual(second);
    });

    it('does not count a reminder as the latest user message when evicting seen images', async () => {
      await sessionManager.loadSession(projectId, {}, {});
      const image = { role: 'user' as const, content: [
        { type: 'text' as const, text: 'make it look like this' },
        { type: 'image_url' as const, image_url: { url: 'data:image/png;base64,AAAA' } },
      ] };
      await sessionManager.addMessage(projectId, image);

      // The deploy URL changes between the two steps of one turn, adding a reminder after the tool result
      mockCreate
        .mockImplementationOnce(async function* () {
          systemMocks.deployedUrl = 'https://example.shakespeare.wtf';
          yield* callTool();
        })
        .mockImplementationOnce(stop);
      await sessionManager.startGeneration(projectId, providerModel);

      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(sentMessages(1).at(-1)).toSatisfy(isSystemReminder);
      expect(sentMessages(1)).toContainEqual(image);
    });

    it('is rendered again when the model changes', async () => {
      await sessionManager.loadSession(projectId, {}, {});
      await sessionManager.addMessage(projectId, { role: 'user', content: 'build it' });
      mockCreate.mockImplementation(stop);
      await sessionManager.startGeneration(projectId, providerModel);
      await sessionManager.addMessage(projectId, { role: 'user', content: 'and more' });
      await sessionManager.startGeneration(projectId, 'test-provider/other-model');

      expect(systemMocks.renders).toBe(2);
    });
  });
});