import { createContext } from 'react';

export interface DeployProvider {
  id: string;
  type: 'shakespeare' | 'netlify' | 'vercel';
  apiKey?: string; // Not used for Shakespeare Deploy
  siteId?: string; // For Netlify
  projectId?: string; // For Vercel
  teamId?: string; // For Vercel
}

export interface DeploySettings {
  providers: DeployProvider[];
  defaultProviderId?: string;
}

export interface DeploySettingsContextType {
  settings: DeploySettings;
  updateSettings: (settings: Partial<DeploySettings>) => void;
  setProvider: (provider: DeployProvider) => void;
  removeProvider: (id: string) => void;
  setProviders: (providers: DeployProvider[]) => void;
  isConfigured: boolean;
}

export const DeploySettingsContext = createContext<DeploySettingsContextType | undefined>(undefined);
