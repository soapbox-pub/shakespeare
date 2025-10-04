// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHead, UnheadProvider } from '@unhead/react/client';
import { InferSeoMetaPlugin } from '@unhead/addons';
import { Suspense, useEffect } from 'react';
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
import { ConsoleErrorProvider } from '@/components/ConsoleErrorProvider';
import { LightningFSAdapter } from '@/lib/LightningFSAdapter';
import { cleanupTmpDirectory } from '@/lib/tmpCleanup';
import { DynamicFavicon } from '@/components/DynamicFavicon';

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
  theme: "system",
  relayUrl: "wss://relay.primal.net",
  deployServer: "shakespeare.wtf",
};

const presetRelays = [
  { url: 'wss://ditto.pub/relay', name: 'Ditto' },
  { url: 'wss://relay.nostr.band', name: 'Nostr.Band' },
  { url: 'wss://relay.damus.io', name: 'Damus' },
  { url: 'wss://relay.primal.net', name: 'Primal' },
];

// Initialize the filesystem
const lightningFS = new LightningFS('shakespeare-fs');
const fs = new LightningFSAdapter(lightningFS.promises);

// Component to handle filesystem cleanup on startup
// Automatically removes files older than 1 hour from /tmp directory
function FSCleanupHandler() {
  useEffect(() => {
    // Run cleanup on application startup to remove stale temporary files
    // This helps prevent the VFS from accumulating old files over time
    cleanupTmpDirectory(fs).catch(console.error);
  }, []);

  return null;
}

export function App() {
  return (
    <UnheadProvider head={head}>
      <QueryClientProvider client={queryClient}>
        <AppProvider storageKey="nostr:app-config" defaultConfig={defaultConfig} presetRelays={presetRelays}>
          <FSProvider fs={fs}>
            <FSCleanupHandler />
            <ConsoleErrorProvider>
              <NostrLoginProvider storageKey='nostr:login'>
                <NostrProvider>
                  <AISettingsProvider>
                    <GitSettingsProvider>
                      <SessionManagerProvider>
                        <TooltipProvider>
                          <Toaster />
                          <DynamicFavicon />
                          <Suspense>
                            <AppRouter />
                          </Suspense>
                        </TooltipProvider>
                      </SessionManagerProvider>
                    </GitSettingsProvider>
                  </AISettingsProvider>
                </NostrProvider>
              </NostrLoginProvider>
            </ConsoleErrorProvider>
          </FSProvider>
        </AppProvider>
      </QueryClientProvider>
    </UnheadProvider>
  );
}

export default App;
