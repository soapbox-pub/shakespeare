import { createContext } from 'react';

export interface ShakespeareDeployProvider {
  name: string;
  type: 'shakespeare';
  baseURL?: string;
}

export interface NetlifyProvider {
  name: string;
  type: 'netlify';
  apiKey: string;
  baseURL?: string;
}

export interface VercelProvider {
  name: string;
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
  removeProvider: (index: number) => void;
  setProviders: (providers: DeployProvider[]) => void;
  isConfigured: boolean;
}

export const DeploySettingsContext = createContext<DeploySettingsContextType | undefined>(undefined);
