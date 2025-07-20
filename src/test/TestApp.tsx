import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createHead, UnheadProvider } from '@unhead/react/client';
import { BrowserRouter } from 'react-router-dom';
import LightningFS from '@isomorphic-git/lightning-fs';
import { NostrLoginProvider } from '@nostrify/react/login';
import NostrProvider from '@/components/NostrProvider';
import { AppProvider } from '@/components/AppProvider';
import { AppConfig } from '@/contexts/AppContext';
import { FSProvider } from '@/components/FSProvider';

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
    relayUrl: 'wss://relay.nostr.band',
  };

  // Initialize LightningFS for testing
  const lightningFS = new LightningFS('test-fs');
  const fs = lightningFS.promises;

  return (
    <UnheadProvider head={head}>
      <AppProvider storageKey='test-app-config' defaultConfig={defaultConfig}>
        <FSProvider fs={fs}>
          <QueryClientProvider client={queryClient}>
            <NostrLoginProvider storageKey='test-login'>
              <NostrProvider>
                <BrowserRouter>
                  {children}
                </BrowserRouter>
              </NostrProvider>
            </NostrLoginProvider>
          </QueryClientProvider>
        </FSProvider>
      </AppProvider>
    </UnheadProvider>
  );
}

export default TestApp;