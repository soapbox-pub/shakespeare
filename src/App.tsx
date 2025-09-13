// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHead, UnheadProvider } from '@unhead/react/client';
import { InferSeoMetaPlugin } from '@unhead/addons';
import { Suspense } from 'react';
import LightningFS from '@isomorphic-git/lightning-fs';
import NostrProvider from '@/components/NostrProvider';
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NostrLoginProvider } from '@nostrify/react/login';
import { AppProvider } from '@/components/AppProvider';
import { AppConfig } from '@/contexts/AppContext';
import { AISettingsProvider } from '@/components/AISettingsProvider';
import { GitSettingsProvider } from '@/components/GitSettingsProvider';
import { SessionManagerProvider } from '@/components/SessionManagerProvider';
import { FSProvider } from '@/components/FSProvider';
import { LightningFSAdapter } from '@/lib/LightningFSAdapter';

import AppRouter from './AppRouter';

const head = createHead({
  plugins: [
    InferSeoMetaPlugin(),
  ],
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute
      gcTime: Infinity,
    },
  },
});

const defaultConfig: AppConfig = {
  theme: "light",
  relayUrl: "wss://relay.primal.net",
  deployServer: "shakespeare.wtf",
};

const presetRelays = [
  { url: 'wss://ditto.pub/relay', name: 'Ditto' },
  { url: 'wss://relay.nostr.band', name: 'Nostr.Band' },
  { url: 'wss://relay.damus.io', name: 'Damus' },
  { url: 'wss://relay.primal.net', name: 'Primal' },
];

// Initialize LightningFS
const lightningFS = new LightningFS('shakespeare-fs');
const fs = new LightningFSAdapter(lightningFS.promises);

export function App() {
  return (
    <UnheadProvider head={head}>
      <AppProvider storageKey="nostr:app-config" defaultConfig={defaultConfig} presetRelays={presetRelays}>
        <FSProvider fs={fs}>
          <QueryClientProvider client={queryClient}>
              <NostrLoginProvider storageKey='nostr:login'>
                <NostrProvider>
                  <AISettingsProvider>
                    <GitSettingsProvider>
                      <SessionManagerProvider>
                      <TooltipProvider>
                        <Toaster />
                        <Suspense>
                          <AppRouter />
                        </Suspense>
                      </TooltipProvider>
                    </SessionManagerProvider>
                    </GitSettingsProvider>
                  </AISettingsProvider>
                </NostrProvider>
              </NostrLoginProvider>
            </QueryClientProvider>
        </FSProvider>
      </AppProvider>
    </UnheadProvider>
  );
}

export default App;
