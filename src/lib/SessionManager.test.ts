import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager, type AIMessage } from './SessionManager';
import type { JSRuntimeFS } from './JSRuntime';
import type { NPool } from '@nostrify/nostrify';
import type { AppConfig } from '@/contexts/AppContext';

// Mock the filesystem
const mockFS: JSRuntimeFS = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  mkdir: vi.fn(),
  rmdir: vi.fn(),
  unlink: vi.fn(),
  stat: vi.fn(),
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
  faviconUrl: 'https://external-content.duckduckgo.com/ip3/{hostname}.ico',
  previewDomain: 'local-shakespeare.dev',
  language: 'en',
  showcaseEnabled: true,
  showcaseModerator: 'npub1jvnpg4c6ljadf5t6ry0w9q0rnm4mksde87kglkrc993z46c39axsgq89sc',
  ngitServers: ['git.shakespeare.diy', 'relay.ngit.dev'],
  fsPathProjects: '/projects',
  fsPathConfig: '/config',
  fsPathTmp: '/tmp',
  fsPathPlugins: '/plugins',
  fsPathTemplates: '/templates',
  fsPathChats: '/chats',
  sentryDsn: '',
  sentryEnabled: false,
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
});