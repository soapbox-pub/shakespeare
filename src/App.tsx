// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHead, UnheadProvider } from '@unhead/react/client';
import { InferSeoMetaPlugin } from '@unhead/addons';
import { Suspense, useEffect } from 'react';
import LightningFS from '@isomorphic-git/lightning-fs';
import NostrProvider from '@/components/NostrProvider';
import { NostrSync } from '@/components/NostrSync';
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NostrLoginProvider } from '@nostrify/react/login';
import { AppProvider } from '@/components/AppProvider';
import { AppConfig } from '@/contexts/AppContext';
import { useAppContext } from '@/hooks/useAppContext';
import { SentryProvider } from '@/components/SentryProvider';
import { AISettingsProvider } from '@/components/AISettingsProvider';
import { GitSettingsProvider } from '@/components/GitSettingsProvider';
import { DeploySettingsProvider } from '@/components/DeploySettingsProvider';
import { SessionManagerProvider } from '@/components/SessionManagerProvider';
import { FSProvider } from '@/components/FSProvider';
import { ConsoleErrorProvider } from '@/components/ConsoleErrorProvider';
import { GitSyncProvider } from '@/components/GitSyncProvider';
import { LightningFSAdapter } from '@/lib/LightningFSAdapter';
import { cleanupTmpDirectory } from '@/lib/tmpCleanup';
import { DynamicFavicon } from '@/components/DynamicFavicon';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { PWAUpdatePrompt } from '@/components/PWAUpdatePrompt';
import { ErrorBoundary } from '@/components/ErrorBoundary';

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
  relayMetadata: {
    relays: [
      { url: 'wss://relay.ditto.pub', read: true, write: true },
      { url: 'wss://relay.nostr.band', read: true, write: true },
      { url: 'wss://relay.primal.net', read: true, write: true },
    ],
    updatedAt: 0,
  },
  graspMetadata: {
    relays: [
      { url: 'wss://git.shakespeare.diy/' },
      { url: 'wss://relay.ngit.dev/' },
    ],
    updatedAt: 0,
  },
  templates: [
    {
      name: "MKStack",
      description: "Build Nostr clients with React. This is the default template that you should choose in the majority of cases. It ships with complete Nostr integration out of the box, enabling a variety of use-cases from social media to blogging to AI-powered apps. If you're not sure which template to choose, choose this one.",
      url: "https://gitlab.com/soapbox-pub/mkstack.git",
    },
    {
      name: "Nutstack",
      description: "This is a variant of MKStack extended to support Cashu integration. Choose this template only if the user has indicated they require Cashu integration.",
      url: "https://gitlab.com/lemonknowsall/nutstack.git",
    },
    {
      name: "Luvstack",
      description: "Barebones React template. Choose this to build mockups or demo sites that don't require Nostr functionality. Only choose this if the user has indicated they want to create a demo or mockup site, as it cannot support any sort of backend functionality or remote storage.",
      url: "https://gitlab.com/soapbox-pub/luvstack.git",
    }
  ],
  esmUrl: "https://esm.sh",
  corsProxy: "https://proxy.shakespeare.diy/?url={href}",
  gitProxyOrigins: ["https://github.com", "https://gitlab.com"],
  faviconUrl: "https://favicon.shakespeare.diy/?url={href}",
  ngitWebUrl: "https://nostrhub.io/{naddr}",
  previewDomain: "local-shakespeare.dev",
  showcaseEnabled: true,
  showcaseModerator: "npub1jvnpg4c6ljadf5t6ry0w9q0rnm4mksde87kglkrc993z46c39axsgq89sc",
  fsPathProjects: "/projects",
  fsPathConfig: "/config",
  fsPathTmp: "/tmp",
  fsPathPlugins: "/plugins",
  fsPathTemplates: "/templates",
  sentryDsn: import.meta.env.VITE_SENTRY_DSN || "",
  sentryEnabled: true,
};

// Initialize filesystem adapter
// Use LightningFS (IndexedDB-backed virtual filesystem)
const fs = new LightningFSAdapter(new LightningFS('shakespeare-fs').promises);

// Component to handle filesystem initialization and cleanup on startup
// Ensures tmp directory exists and removes files older than 1 hour
function FSCleanupHandler() {
  const { config } = useAppContext();

  useEffect(() => {
    // Ensure tmp directory exists before cleanup
    const initializeAndCleanup = async () => {
      try {
        // Create tmp directory if it doesn't exist
        try {
          await fs.stat(config.fsPathTmp);
        } catch {
          // Directory doesn't exist, create it
          await fs.mkdir(config.fsPathTmp);
          console.log(`Created ${config.fsPathTmp} directory`);
        }

        // Run cleanup to remove stale temporary files
        // This helps prevent the VFS from accumulating old files over time
        await cleanupTmpDirectory(fs, config.fsPathTmp);
      } catch (error) {
        console.error(`Error during filesystem initialization:`, error);
      }
    };

    initializeAndCleanup();
  }, [config.fsPathTmp]);

  return null;
}

export function App() {
  return (
    <ErrorBoundary>
      <UnheadProvider head={head}>
        <QueryClientProvider client={queryClient}>
          <AppProvider storageKey="nostr:app-config" defaultConfig={defaultConfig}>
            <SentryProvider>
              <FSProvider fs={fs}>
                <ConsoleErrorProvider>
                  <FSCleanupHandler />
                  <NostrLoginProvider storageKey='nostr:login'>
                    <NostrProvider>
                      <NostrSync />
                      <AISettingsProvider>
                        <GitSettingsProvider>
                          <DeploySettingsProvider>
                            <GitSyncProvider>
                              <SessionManagerProvider>
                                <TooltipProvider>
                                  <Toaster />
                                  <DynamicFavicon />
                                  <OfflineIndicator />
                                  <PWAUpdatePrompt />
                                  <Suspense>
                                    <AppRouter />
                                  </Suspense>
                                </TooltipProvider>
                              </SessionManagerProvider>
                            </GitSyncProvider>
                          </DeploySettingsProvider>
                        </GitSettingsProvider>
                      </AISettingsProvider>
                    </NostrProvider>
                  </NostrLoginProvider>
                </ConsoleErrorProvider>
              </FSProvider>
            </SentryProvider>
          </AppProvider>
        </QueryClientProvider>
      </UnheadProvider>
    </ErrorBoundary>
  );
}

export default App;
