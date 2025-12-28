import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createHead, UnheadProvider } from '@unhead/react/client';
import { BrowserRouter } from 'react-router-dom';
import LightningFS from '@isomorphic-git/lightning-fs';
import { NostrLoginProvider } from '@nostrify/react/login';
import NostrProvider from '@/components/NostrProvider';
import { AppProvider } from '@/components/AppProvider';
import { AppConfig } from '@/contexts/AppContext';
import { FSProvider } from '@/components/FSProvider';
import { LightningFSAdapter } from '@/lib/LightningFSAdapter';
import { AISettingsProvider } from '@/components/AISettingsProvider';
import { GitSettingsProvider } from '@/components/GitSettingsProvider';
import { SessionManagerProvider } from '@/components/SessionManagerProvider';
import '@/lib/i18n';

interface TestAppProps {
  children: React.ReactNode;
}

export function TestApp({ children }: TestAppProps) {
  const head = createHead();

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const defaultConfig: AppConfig = {
    theme: 'light',
    relayMetadata: {
      relays: [
        { url: 'wss://relay.nostr.band', read: true, write: true },
      ],
      updatedAt: 0,
    },
    templates: [
      {
        name: "MKStack",
        description: "Build Nostr clients with React.",
        url: "https://gitlab.com/soapbox-pub/mkstack.git"
      }
    ],
    esmUrl: 'https://esm.shakespeare.diy',
    corsProxy: 'https://proxy.shakespeare.diy/?url={href}',
    gitProxyOrigins: ['https://github.com', 'https://gitlab.com'],
    faviconUrl: 'https://external-content.duckduckgo.com/ip3/{hostname}.ico',
    ngitWebUrl: 'https://nostrhub.io/{naddr}',
    previewDomain: 'local-shakespeare.dev',
    language: 'en',
    showcaseEnabled: true,
    showcaseModerator: 'npub1jvnpg4c6ljadf5t6ry0w9q0rnm4mksde87kglkrc993z46c39axsgq89sc',
    graspMetadata: {
      relays: [
        { url: 'wss://git.shakespeare.diy/' },
        { url: 'wss://relay.ngit.dev/' },
      ],
      updatedAt: 0,
    },
    fsPathProjects: '/projects',
    fsPathConfig: '/config',
    fsPathTmp: '/tmp',
    fsPathPlugins: '/plugins',
    fsPathTemplates: '/templates',
    sentryDsn: '',
    sentryEnabled: false,
  };

  // Initialize LightningFS for testing
  const lightningFS = new LightningFS('test-fs');
  const fs = new LightningFSAdapter(lightningFS.promises);

  return (
    <UnheadProvider head={head}>
      <QueryClientProvider client={queryClient}>
        <AppProvider storageKey='test-app-config' defaultConfig={defaultConfig}>
          <FSProvider fs={fs}>
            <AISettingsProvider>
              <GitSettingsProvider>
                <NostrLoginProvider storageKey='test-login'>
                  <NostrProvider>
                    <SessionManagerProvider>
                      <BrowserRouter>
                        {children}
                      </BrowserRouter>
                    </SessionManagerProvider>
                  </NostrProvider>
                </NostrLoginProvider>
              </GitSettingsProvider>
            </AISettingsProvider>
          </FSProvider>
        </AppProvider>
      </QueryClientProvider>
    </UnheadProvider>
  );
}

export default TestApp;