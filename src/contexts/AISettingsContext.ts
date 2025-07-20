import { createContext } from 'react';

export interface AISettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AISettingsContextType {
  settings: AISettings;
  updateSettings: (settings: Partial<AISettings>) => void;
  isConfigured: boolean;
}

export const AISettingsContext = createContext<AISettingsContextType | undefined>(undefined);