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
function getElectronDefaultPaths(): { fsPathProjects: string; fsPathConfig: string; fsPathTmp: string; fsPathPlugins: string; fsPathTemplates: string } {
  if (!globalThis.electron) {
    // Browser defaults - use virtual filesystem paths
    return {
      fsPathProjects: "/projects",
      fsPathConfig: "/config",
      fsPathTmp: "/tmp",
      fsPathPlugins: "/plugins",
      fsPathTemplates: "/templates",
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
    };
  } else if (platform.includes('mac')) {
    // macOS
    return {
      fsPathProjects: "~/Projects",
      fsPathConfig: "~/Library/Application Support/shakespeare",
      fsPathTmp: "/tmp/shakespeare",
      fsPathPlugins: "~/Library/Application Support/shakespeare/plugins",
      fsPathTemplates: "~/Library/Application Support/shakespeare/templates",
    };
  } else {
    // Linux and other Unix-like systems
    return {
      fsPathProjects: "~/Projects",
      fsPathConfig: "~/.config/shakespeare",
      fsPathTmp: "/tmp/shakespeare",
      fsPathPlugins: "~/.config/shakespeare/plugins",
      fsPathTemplates: "~/.config/shakespeare/templates",
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
  projectTemplate: "https://gitlab.com/soapbox-pub/mkstack.git",
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
