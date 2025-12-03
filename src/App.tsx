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
import { LightningFSAdapter } from '@/lib/LightningFSAdapter';
import { ElectronFSAdapter } from '@/lib/ElectronFSAdapter';
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

// Get OS-specific default paths for Electron
function getElectronDefaultPaths(): { fsPathProjects: string; fsPathConfig: string; fsPathTmp: string; fsPathPlugins: string; fsPathTemplates: string; fsPathChats: string } {
  if (!globalThis.electron) {
    // Browser defaults - use virtual filesystem paths
    return {
      fsPathProjects: "/projects",
      fsPathConfig: "/config",
      fsPathTmp: "/tmp",
      fsPathPlugins: "/plugins",
      fsPathTemplates: "/templates",
      fsPathChats: "/chats",
    };
  }

  // Electron defaults - use OS-specific paths
  // Note: The ~ will be expanded by the Electron main process
  const platform = navigator.platform.toLowerCase();

  if (platform.includes('win')) {
    // Windows
    return {
      fsPathProjects: "~/Documents/Projects",
      fsPathConfig: "~/AppData/Local/shakespeare",
      fsPathTmp: "~/AppData/Local/Temp/shakespeare",
      fsPathPlugins: "~/AppData/Local/shakespeare/plugins",
      fsPathTemplates: "~/AppData/Local/shakespeare/templates",
      fsPathChats: "~/Documents/Chats",
    };
  } else if (platform.includes('mac')) {
    // macOS
    return {
      fsPathProjects: "~/Projects",
      fsPathConfig: "~/Library/Application Support/shakespeare",
      fsPathTmp: "/tmp/shakespeare",
      fsPathPlugins: "~/Library/Application Support/shakespeare/plugins",
      fsPathTemplates: "~/Library/Application Support/shakespeare/templates",
      fsPathChats: "~/Chats",
    };
  } else {
    // Linux and other Unix-like systems
    return {
      fsPathProjects: "~/Projects",
      fsPathConfig: "~/.config/shakespeare",
      fsPathTmp: "/tmp/shakespeare",
      fsPathPlugins: "~/.config/shakespeare/plugins",
      fsPathTemplates: "~/.config/shakespeare/templates",
      fsPathChats: "~/Chats",
    };
  }
}

const electronPaths = getElectronDefaultPaths();

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
      description: "Barebones React template. Choose this to build mockups or demo sites that don't require Nostr functionality. Only choose this if the user has indicated they want to create a demo or mockup site, as it cannot support any sort of backend functionality or remote storage. It might also work for simple PWAs.",
      url: "https://gitlab.com/soapbox-pub/luvstack.git",
    }
  ],
  esmUrl: "https://esm.sh",
  corsProxy: "https://proxy.shakespeare.diy/?url={href}",
  faviconUrl: "https://favicon.shakespeare.diy/?url={href}",
  previewDomain: "local-shakespeare.dev",
  showcaseEnabled: true,
  showcaseModerator: "npub1jvnpg4c6ljadf5t6ry0w9q0rnm4mksde87kglkrc993z46c39axsgq89sc",
  ngitServers: ["git.shakespeare.diy", "relay.ngit.dev"],
  fsPathProjects: electronPaths.fsPathProjects,
  fsPathConfig: electronPaths.fsPathConfig,
  fsPathTmp: electronPaths.fsPathTmp,
  fsPathPlugins: electronPaths.fsPathPlugins,
  fsPathTemplates: electronPaths.fsPathTemplates,
  fsPathChats: electronPaths.fsPathChats,
  sentryDsn: import.meta.env.VITE_SENTRY_DSN || "",
  sentryEnabled: true,
};

// Initialize filesystem adapter based on environment
// In Electron, use Electron filesystem at ~/shakespeare
// In browser, use LightningFS (IndexedDB-backed virtual filesystem)
const fs = globalThis.electron
  ? new ElectronFSAdapter()
  : new LightningFSAdapter(new LightningFS('shakespeare-fs').promises);

// Component to handle filesystem cleanup on startup
// Automatically removes files older than 1 hour from tmp directory
function FSCleanupHandler() {
  const { config } = useAppContext();

  useEffect(() => {
    // Run cleanup on application startup to remove stale temporary files
    // This helps prevent the VFS from accumulating old files over time
    cleanupTmpDirectory(fs, config.fsPathTmp).catch(console.error);
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
