import { createContext } from 'react';

export interface AIProvider {
  id: string;
  name: string;
  baseURL: string;
  apiKey?: string;
  nostr?: boolean;
  proxy?: boolean;
  openSecret?: string;
}

export interface MCPServer {
  type: 'streamable-http';
  url: string;
  headers?: Record<string, string>;
}

export interface MCPServers {
  [key: string]: MCPServer;
}

export const REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type ReasoningEffort = typeof REASONING_EFFORTS[number];
/** Used when no effort is configured. Models' own defaults are often `high`, which thinks at length. */
export const DEFAULT_REASONING_EFFORT: ReasoningEffort = 'medium';

export interface AISettings {
  providers: AIProvider[];
  recentlyUsedModels: string[];
  imageModel?: string;
  mcpServers?: MCPServers;
  /** How much reasoning models think. `default` leaves it to the model. */
  reasoningEffort?: ReasoningEffort | 'default';
}

export interface AISettingsContextType {
  settings: AISettings;
  updateSettings: (settings: Partial<AISettings>) => void;
  setProvider: (provider: AIProvider) => void;
  removeProvider: (id: string) => void;
  setProviders: (providers: AIProvider[]) => void;
  addRecentlyUsedModel: (modelId: string) => void;
  setMCPServer: (name: string, server: MCPServer) => void;
  removeMCPServer: (name: string) => void;
  isConfigured: boolean;
  isLoading: boolean;
}

export const AISettingsContext = createContext<AISettingsContextType | undefined>(undefined);