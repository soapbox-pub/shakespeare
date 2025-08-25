import { createContext } from 'react';

export interface AIConnection {
  baseURL: string;
  apiKey: string;
}

export interface AISettings {
  providers: Record<string, AIConnection>;
}

export interface AISettingsContextType {
  settings: AISettings;
  updateSettings: (settings: Partial<AISettings>) => void;
  addProvider: (name: string, connection: AIConnection) => void;
  removeProvider: (name: string) => void;
  updateProvider: (name: string, connection: Partial<AIConnection>) => void;
  isConfigured: boolean;
}

export const AISettingsContext = createContext<AISettingsContextType | undefined>(undefined);