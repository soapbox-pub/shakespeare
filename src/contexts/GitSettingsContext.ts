import { createContext } from 'react';

export interface GitCredential {
  username: string;
  password: string;
}

export interface GitSettings {
  credentials: Record<string, GitCredential>; // keyed by origin
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
  isConfigured: boolean;
  isInitialized: boolean;
}

export const GitSettingsContext = createContext<GitSettingsContextType | undefined>(undefined);