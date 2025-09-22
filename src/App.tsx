// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHead, UnheadProvider } from '@unhead/react/client';
import { InferSeoMetaPlugin } from '@unhead/addons';
import { Suspense, useEffect, useState } from 'react';
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
import { OPFSAdapterSimple } from '@/lib/OPFSAdapterSimple';
import { cleanupTmpDirectory } from '@/lib/tmpCleanup';
import type { JSRuntimeFS } from '@/lib/JSRuntime';
import { useAppContext } from '@/hooks/useAppContext';
import { useFS } from '@/hooks/useFS';

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
  filesystemType: "lightningfs",
};

const presetRelays = [
  { url: 'wss://ditto.pub/relay', name: 'Ditto' },
  { url: 'wss://relay.nostr.band', name: 'Nostr.Band' },
  { url: 'wss://relay.damus.io', name: 'Damus' },
  { url: 'wss://relay.primal.net', name: 'Primal' },
];

// Component to handle filesystem initialization and cleanup
function FilesystemProvider({ children }: { children: React.ReactNode }) {
  const { config } = useAppContext();
  const [fs, setFS] = useState<JSRuntimeFS | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeFilesystem = async () => {
      try {
        let filesystem: JSRuntimeFS;

        if (config.filesystemType === 'opfs') {
          // Check if OPFS is available
          if (!('storage' in navigator) || typeof (navigator.storage as unknown as { getDirectory: () => Promise<FileSystemDirectoryHandle> }).getDirectory !== 'function') {
            throw new Error('OPFS is not supported in this browser');
          }
          filesystem = new OPFSAdapterSimple();
        } else {
          // Default to LightningFS
          const lightningFS = new LightningFS('shakespeare-fs');
          filesystem = new LightningFSAdapter(lightningFS.promises);
        }

        setFS(filesystem);
        setError(null);
      } catch (err) {
        console.error('Failed to initialize filesystem:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize filesystem');

        // Fallback to LightningFS if OPFS fails
        if (config.filesystemType === 'opfs') {
          try {
            const lightningFS = new LightningFS('shakespeare-fs');
            const fallbackFs = new LightningFSAdapter(lightningFS.promises);
            setFS(fallbackFs);
            console.warn('Falling back to LightningFS due to OPFS initialization error');
          } catch (fallbackErr) {
            setError(`Failed to initialize both OPFS and LightningFS: ${fallbackErr}`);
          }
        }
      }
    };

    initializeFilesystem();
  }, [config.filesystemType]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-600">Filesystem Error</h1>
          <p className="text-muted-foreground">{error}</p>
          <p className="text-sm text-muted-foreground">
            Please try refreshing the page or using a different browser.
            If the problem persists, you may need to clear browser data and try again.
          </p>
        </div>
      </div>
    );
  }

  if (!fs) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Initializing filesystem...</p>
        </div>
      </div>
    );
  }

  return <FSProvider fs={fs}>{children}</FSProvider>;
}

// Component to handle filesystem cleanup on startup
// Automatically removes files older than 1 hour from /tmp directory
function FSCleanupHandler() {
  const { fs } = useFS();

  useEffect(() => {
    if (fs) {
      // Run cleanup on application startup to remove stale temporary files
      // This helps prevent the VFS from accumulating old files over time
      cleanupTmpDirectory(fs).catch(console.error);
    }
  }, [fs]);

  return null;
}

export function App() {
  return (
    <UnheadProvider head={head}>
      <QueryClientProvider client={queryClient}>
        <AppProvider storageKey="nostr:app-config" defaultConfig={defaultConfig} presetRelays={presetRelays}>
          <FilesystemProvider>
            <FSCleanupHandler />
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
          </FilesystemProvider>
        </AppProvider>
      </QueryClientProvider>
    </UnheadProvider>
  );
}

export default App;
