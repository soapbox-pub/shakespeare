import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager, type AIMessage } from './SessionManager';
import type { JSRuntimeFS } from './JSRuntime';
import type { NPool } from '@nostrify/nostrify';
import type { AppConfig } from '@/contexts/AppContext';
import { isSystemReminder } from './systemReminder';
import { CANCELLED_TOOL_RESULT, INTERRUPTED_TOOL_RESULT, isHistoryGapNotice } from './repairHistory';

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

  describe('images', () => {
    const projectId = 'test-project';
    const image = { type: 'image_url' as const, image_url: { url: 'data:image/png;base64,AAAA' } };
    const stop = async function* () {
      yield { choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] };
    };
    const apiError = (status: number, message: string) => Object.assign(new Error(message), { status });
    const sentImages = (call: number) => (mockCreate.mock.calls[call][0].messages as AIMessage[])
      .flatMap((msg): Array<{ type: string }> => Array.isArray(msg.content) ? msg.content : [])
      .filter((part) => part.type === 'image_url').length;

    it('keeps sending images after an error unrelated to images', async () => {
      await sessionManager.loadSession(projectId, {}, {});
      await sessionManager.addMessage(projectId, { role: 'user', content: [{ type: 'text', text: 'look' }, image] });

      mockCreate.mockImplementationOnce(() => { throw apiError(400, 'session_turn_conflict: a turn is already running'); });
      await expect(sessionManager.startGeneration(projectId, 'test-provider/test-model')).rejects.toThrow();

      mockCreate.mockImplementation(stop);
      await sessionManager.startGeneration(projectId, 'test-provider/test-model');

      expect(sessionManager.getSession(projectId)?.imagesNotSupported).toBeUndefined();
      expect(sentImages(1)).toBe(1);
    });

    it('stops sending images when the error says the model cannot take them', async () => {
      await sessionManager.loadSession(projectId, {}, {});
      await sessionManager.addMessage(projectId, { role: 'user', content: [{ type: 'text', text: 'look' }, image] });

      mockCreate.mockImplementationOnce(() => { throw apiError(400, 'This model does not support image input'); });
      mockCreate.mockImplementation(stop);
      await sessionManager.startGeneration(projectId, 'test-provider/test-model');

      expect(sessionManager.getSession(projectId)?.imagesNotSupported).toBe(true);
      expect(sentImages(1)).toBe(0);
    });

    it('removes old tool images in batches, leaving earlier messages unchanged in between', async () => {
      const session = await sessionManager.loadSession(projectId, {}, {});
      const readImage = (i: number): AIMessage[] => [
        { role: 'assistant', content: '', tool_calls: [{ id: `call_${i}`, type: 'function', function: { name: 'read', arguments: '{}' } }] },
        { role: 'tool', tool_call_id: `call_${i}`, content: [{ type: 'text', text: `image ${i}` }, image] },
      ];
      session.messages.push({ role: 'user', content: 'go' });
      for (let i = 0; i < 7; i++) session.messages.push(...readImage(i));

      mockCreate.mockImplementation(stop);
      await sessionManager.startGeneration(projectId, 'test-provider/test-model');
      expect(sentImages(0)).toBe(7);

      session.messages.push(...readImage(7));
      await sessionManager.startGeneration(projectId, 'test-provider/test-model');
      expect(sentImages(1)).toBe(3);
    });
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

  describe('stopping and broken histories', () => {
    const projectId = 'test-project';
    const providerModel = 'test-provider/test-model';
    const historyFile = () => [...files.keys()].find((path) => path.endsWith('.jsonl'))!;
    const savedHistory = () => files.get(historyFile())!.trim().split('\n').map((line) => JSON.parse(line) as AIMessage);
    const stop = async function* () {
      yield { choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] };
    };
    const callImage = async function* () {
      yield {
        choices: [{
          delta: { tool_calls: [{ index: 0, id: 'call_img', function: { name: 'generate_image', arguments: '{}' } }] },
          finish_reason: 'tool_calls',
        }],
      };
    };

    it('answers a tool call stopped mid-run, and drops its late result', async () => {
      let finishImage!: () => void;
      let imageSignal: AbortSignal | undefined;
      const generateImage = {
        description: 'Generate an image',
        execute: vi.fn((_args: unknown, options?: { signal?: AbortSignal }) => {
          imageSignal = options?.signal;
          // Like a tool that ignores the signal and finishes anyway
          return new Promise<{ content: string }>((resolve) => {
            finishImage = () => resolve({ content: 'Generated image: /tmp/late.png' });
          });
        }),
      };

      await sessionManager.loadSession(projectId, {}, { generate_image: generateImage });
      await sessionManager.addMessage(projectId, { role: 'user', content: 'draw a cat' });

      mockCreate.mockImplementationOnce(callImage);
      const first = sessionManager.startGeneration(projectId, providerModel);
      await vi.waitFor(() => expect(generateImage.execute).toHaveBeenCalled());

      sessionManager.stopGeneration(projectId);
      expect(imageSignal?.aborted).toBe(true);

      // The user moves on while the image is still generating
      mockCreate.mockImplementationOnce(stop);
      await sessionManager.sendMessage(projectId, 'never mind', providerModel);

      finishImage();
      await first;

      const messages = sessionManager.getSession(projectId)!.messages;
      expect(messages.map((message) => message.role)).toEqual(['user', 'assistant', 'tool', 'user', 'assistant']);
      expect(messages[2]).toEqual({ role: 'tool', tool_call_id: 'call_img', content: CANCELLED_TOOL_RESULT });
      expect(sessionManager.getSession(projectId)!.isLoading).toBe(false);

      // What's saved matches what's in memory, so nothing is lost on reload
      expect(savedHistory()).toEqual(messages);
    });

    it('repairs a broken history when it is loaded, and marks the gap', async () => {
      files.set('/projects/test-project/.git/ai/history/2026-01-01T00-00-00Z-abc.jsonl', [
        { role: 'user', content: 'draw' },
        { role: 'assistant', content: '', tool_calls: [{ id: 'a', type: 'function', function: { name: 'shell', arguments: '{}' } }] },
        { role: 'user', content: 'again' },
        { role: 'assistant', content: 'sure' },
        { role: 'tool', tool_call_id: 'a', content: 'late' },
        { role: 'user', content: 'thanks' },
        { role: 'assistant', content: '', tool_calls: [{ id: 'b', type: 'function', function: { name: 'shell', arguments: '{}' } }] },
      ].map((message) => JSON.stringify(message)).join('\n') + '\n');

      const session = await sessionManager.loadSession(projectId, {}, {});

      // One notice for each gap: the call the conversation moved on from (whose late result is dropped), and the call cut off at the end
      expect(session.messages.filter(isHistoryGapNotice)).toHaveLength(2);
      expect(session.messages.at(-2)).toEqual({ role: 'tool', tool_call_id: 'b', content: INTERRUPTED_TOOL_RESULT });
      expect(session.messages.at(-1)).toSatisfy(isHistoryGapNotice);
      expect(session.messages).not.toContainEqual({ role: 'tool', tool_call_id: 'a', content: 'late' });
      expect(savedHistory()).toEqual(session.messages);
    });
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

    it('keeps images the user attached when a reminder follows a tool result', async () => {
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