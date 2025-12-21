import { createContext } from 'react';

export interface GitCredential {
  id: string; // UUID generated with crypto.randomUUID()
  name: string; // Display name for the credential
  protocol: string;
  host: string; // Includes port if non-standard (e.g., "github.com:8080")
  username: string;
  password: string;
}

export interface GitSettings {
  credentials: GitCredential[];
  name?: string;
  email?: string;
  coAuthorEnabled?: boolean;
}

export interface GitSettingsContextType {
  settings: GitSettings;
  updateSettings: (settings: Partial<GitSettings>) => void;
  addCredential: (credential: GitCredential) => void;
  removeCredential: (id: string) => void;
  setCredentials: (credentials: GitCredential[]) => void;
  isConfigured: boolean;
  isInitialized: boolean;
}

export const GitSettingsContext = createContext<GitSettingsContextType | undefined>(undefined);