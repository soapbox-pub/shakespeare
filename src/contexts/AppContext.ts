import { createContext } from "react";

export type Theme = "dark" | "light" | "system";

export interface RelayMetadata {
  /** List of relays with read/write permissions */
  relays: { url: string; read: boolean; write: boolean }[];
  /** Unix timestamp of when the relay list was last updated */
  updatedAt: number;
}

export interface AppConfig {
  /** Current theme */
  theme: Theme;
  /** NIP-65 relay list metadata */
  relayMetadata: RelayMetadata;
  /** Git repository URL to use as project template */
  projectTemplate: string;
  /** ESM CDN URL for package imports */
  esmUrl: string;
  /** HTTP proxy used to bypass CORS for AI and Git operations */
  corsProxy: string;
  /** Favicon URL template (e.g., "https://external-content.duckduckgo.com/ip3/{hostname}.ico") */
  faviconUrl: string;
  /** Preview domain for iframe sandboxing (e.g., "local-shakespeare.dev") */
  previewDomain: string;
  /** Selected language */
  language?: string;
  /** Whether to show the showcase section */
  showcaseEnabled: boolean;
  /** Npub of the showcase moderator */
  showcaseModerator: string;
  /** Nostr Git Servers (hostnames) */
  ngitServers: string[];
  /** VFS path for projects directory */
  fsPathProjects: string;
  /** VFS path for config directory */
  fsPathConfig: string;
  /** VFS path for temporary files directory */
  fsPathTmp: string;
  /** VFS path for plugins directory */
  fsPathPlugins: string;
  /** Sentry DSN for error reporting (empty string = disabled) */
  sentryDsn: string;
  /** Whether the user has enabled Sentry error reporting */
  sentryEnabled: boolean;
}

export interface AppContextType {
  /** Current application configuration */
  config: AppConfig;
  /** Update configuration using a callback that receives current config and returns new config */
  updateConfig: (updater: (currentConfig: Partial<AppConfig>) => Partial<AppConfig>) => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);
