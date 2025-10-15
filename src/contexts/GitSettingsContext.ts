import { createContext } from 'react';

export interface GitCredential {
  username: string;
  password: string;
}

export interface GitHostToken {
  token: string;
  username?: string;
  scopes?: string[];
  createdAt?: number;
}

export interface GitSettings {
  credentials: Record<string, GitCredential>; // keyed by origin
  hostTokens: Record<string, GitHostToken>; // keyed by host domain (e.g., 'github.com')
  name?: string;
  email?: string;
  coAuthorEnabled?: boolean;
}

export interface GitSettingsContextType {
  settings: GitSettings;
  updateSettings: (settings: Partial<GitSettings>) => void;
  addCredential: (origin: string, credential: GitCredential) => void;
  removeCredential: (origin: string) => void;
  updateCredential: (origin: string, credential: Partial<GitCredential>) => void;
  addHostToken: (host: string, token: GitHostToken) => void;
  removeHostToken: (host: string) => void;
  updateHostToken: (host: string, token: Partial<GitHostToken>) => void;
  isConfigured: boolean;
}

export const GitSettingsContext = createContext<GitSettingsContextType | undefined>(undefined);