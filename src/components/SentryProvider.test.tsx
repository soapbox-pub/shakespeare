import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { SentryProvider } from './SentryProvider';
import { AppContext } from '@/contexts/AppContext';
import * as sentryModule from '@/lib/sentry';

// Mock the sentry module
vi.mock('@/lib/sentry', () => ({
  initializeSentry: vi.fn(() => Promise.resolve()),
  disableSentry: vi.fn(() => Promise.resolve()),
  isSentryInitialized: vi.fn(() => false),
}));

describe('SentryProvider', () => {
  const mockUpdateConfig = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes Sentry when both DSN and sentryEnabled are true', async () => {
    const config = {
      sentryDsn: 'https://test@sentry.io/123',
      sentryEnabled: true,
      theme: 'light' as const,
      relayMetadata: {
        relays: [{ url: 'wss://relay.test', read: true, write: true }],
        updatedAt: 0,
      },
      templates: [{ name: 'Test', description: 'Test template', url: 'https://test.git' }],
      esmUrl: 'https://esm.test',
      corsProxy: 'https://proxy.test/{href}',
      faviconUrl: 'https://favicon.test/{href}',
      previewDomain: 'test.dev',
      showcaseEnabled: false,
      showcaseModerator: '',
      ngitServers: [],
      fsPathProjects: '/projects',
      fsPathConfig: '/config',
      fsPathTmp: '/tmp',
      fsPathPlugins: '/plugins',
      fsPathTemplates: '/templates',
      fsPathChats: '/chats',
    };

    render(
      <AppContext.Provider value={{ config, defaultConfig: config, updateConfig: mockUpdateConfig }}>
        <SentryProvider>
          <div>Test</div>
        </SentryProvider>
      </AppContext.Provider>
    );

    await waitFor(() => {
      expect(sentryModule.initializeSentry).toHaveBeenCalledWith('https://test@sentry.io/123');
    });
  });

  it('does not initialize Sentry when DSN is empty', async () => {
    const config = {
      sentryDsn: '',
      sentryEnabled: true,
      theme: 'light' as const,
      relayMetadata: {
        relays: [{ url: 'wss://relay.test', read: true, write: true }],
        updatedAt: 0,
      },
      templates: [{ name: 'Test', description: 'Test template', url: 'https://test.git' }],
      esmUrl: 'https://esm.test',
      corsProxy: 'https://proxy.test/{href}',
      faviconUrl: 'https://favicon.test/{href}',
      previewDomain: 'test.dev',
      showcaseEnabled: false,
      showcaseModerator: '',
      ngitServers: [],
      fsPathProjects: '/projects',
      fsPathConfig: '/config',
      fsPathTmp: '/tmp',
      fsPathPlugins: '/plugins',
      fsPathTemplates: '/templates',
      fsPathChats: '/chats',
    };

    render(
      <AppContext.Provider value={{ config, defaultConfig: config, updateConfig: mockUpdateConfig }}>
        <SentryProvider>
          <div>Test</div>
        </SentryProvider>
      </AppContext.Provider>
    );

    // Wait a bit to ensure no initialization happens
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(sentryModule.initializeSentry).not.toHaveBeenCalled();
  });

  it('does not initialize Sentry when sentryEnabled is false', async () => {
    const config = {
      sentryDsn: 'https://test@sentry.io/123',
      sentryEnabled: false,
      theme: 'light' as const,
      relayMetadata: {
        relays: [{ url: 'wss://relay.test', read: true, write: true }],
        updatedAt: 0,
      },
      templates: [{ name: 'Test', description: 'Test template', url: 'https://test.git' }],
      esmUrl: 'https://esm.test',
      corsProxy: 'https://proxy.test/{href}',
      faviconUrl: 'https://favicon.test/{href}',
      previewDomain: 'test.dev',
      showcaseEnabled: false,
      showcaseModerator: '',
      ngitServers: [],
      fsPathProjects: '/projects',
      fsPathConfig: '/config',
      fsPathTmp: '/tmp',
      fsPathPlugins: '/plugins',
      fsPathTemplates: '/templates',
      fsPathChats: '/chats',
    };

    render(
      <AppContext.Provider value={{ config, defaultConfig: config, updateConfig: mockUpdateConfig }}>
        <SentryProvider>
          <div>Test</div>
        </SentryProvider>
      </AppContext.Provider>
    );

    // Wait a bit to ensure no initialization happens
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(sentryModule.initializeSentry).not.toHaveBeenCalled();
  });

  it('disables Sentry when it was initialized but conditions change', async () => {
    // Mock that Sentry is initialized
    vi.mocked(sentryModule.isSentryInitialized).mockReturnValue(true);

    const config = {
      sentryDsn: '',
      sentryEnabled: false,
      theme: 'light' as const,
      relayMetadata: {
        relays: [{ url: 'wss://relay.test', read: true, write: true }],
        updatedAt: 0,
      },
      templates: [{ name: 'Test', description: 'Test template', url: 'https://test.git' }],
      esmUrl: 'https://esm.test',
      corsProxy: 'https://proxy.test/{href}',
      faviconUrl: 'https://favicon.test/{href}',
      previewDomain: 'test.dev',
      showcaseEnabled: false,
      showcaseModerator: '',
      ngitServers: [],
      fsPathProjects: '/projects',
      fsPathConfig: '/config',
      fsPathTmp: '/tmp',
      fsPathPlugins: '/plugins',
      fsPathTemplates: '/templates',
      fsPathChats: '/chats',
    };

    render(
      <AppContext.Provider value={{ config, defaultConfig: config, updateConfig: mockUpdateConfig }}>
        <SentryProvider>
          <div>Test</div>
        </SentryProvider>
      </AppContext.Provider>
    );

    await waitFor(() => {
      expect(sentryModule.disableSentry).toHaveBeenCalled();
    });
  });
});
