import { createContext } from 'react';

export interface ShakespeareDeployProvider {
  id: string;
  type: 'shakespeare';
  baseURL?: string;
}

export interface NetlifyProvider {
  id: string;
  type: 'netlify';
  apiKey: string;
  baseURL?: string;
}

export interface VercelProvider {
  id: string;
  type: 'vercel';
  apiKey: string;
  baseURL?: string;
}

export type DeployProvider = ShakespeareDeployProvider | NetlifyProvider | VercelProvider;

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
