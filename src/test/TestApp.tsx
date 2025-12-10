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
    sentryDsn: '',
    sentryEnabled: false,
    communityFollowPack: 'naddr1qvzqqqr4xgpzpjcswsacvumftxsmcejj3vsxu8mf203p8hkxoklxtgva7rdxzm0qqy88wumn8ghj7mn0wd68yttsw43z7qg4waehxw309aex2mrp0yhx6mmddaehgu339e3k7mf0qythwumn8ghj7cn5vvhxkmr9dejxz7n0xvs8xmmrdejhytnrdakj7q3qdqr8kgh3s5q8ztw0swmvpwz98cse7rw43n4nhrpszgafnuwrxh8hscmhv5m',
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