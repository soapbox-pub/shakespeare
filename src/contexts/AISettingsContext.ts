import { createContext } from 'react';

export interface AIProvider {
  id: string;
  baseURL: string;
  apiKey?: string;
  nostr?: boolean;
  proxy?: boolean;
}

export interface MCPServer {
  type: 'streamable-http';
  url: string;
}

export interface MCPServers {
  [key: string]: MCPServer;
}

export interface AISettings {
  providers: AIProvider[];
  recentlyUsedModels: string[];
  mcpServers?: MCPServers;
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
}

export const AISettingsContext = createContext<AISettingsContextType | undefined>(undefined);