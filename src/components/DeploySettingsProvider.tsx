import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { DeploySettingsContext, type DeploySettings, type DeployProvider } from '@/contexts/DeploySettingsContext';

const STORAGE_KEY = 'shakespeare-deploy-settings';

const DEFAULT_SETTINGS: DeploySettings = {
  providers: [],
};

export function DeploySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DeploySettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load deploy settings:', error);
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save deploy settings:', error);
    }
  }, [settings]);

  const updateSettings = (updates: Partial<DeploySettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const setProvider = (provider: DeployProvider) => {
    setSettings(prev => {
      const existingIndex = prev.providers.findIndex(p => p.id === provider.id);
      
      if (existingIndex >= 0) {
        // Update existing provider
        const newProviders = [...prev.providers];
        newProviders[existingIndex] = provider;
        return { ...prev, providers: newProviders };
      } else {
        // Add new provider
        return { ...prev, providers: [...prev.providers, provider] };
      }
    });
  };

  const removeProvider = (id: string) => {
    setSettings(prev => ({
      ...prev,
      providers: prev.providers.filter(p => p.id !== id),
      // Clear default if it was removed
      defaultProviderId: prev.defaultProviderId === id ? undefined : prev.defaultProviderId,
    }));
  };

  const setProviders = (providers: DeployProvider[]) => {
    setSettings(prev => ({ ...prev, providers }));
  };

  const isConfigured = useMemo(() => {
    return settings.providers.length > 0;
  }, [settings.providers]);

  const value = {
    settings,
    updateSettings,
    setProvider,
    removeProvider,
    setProviders,
    isConfigured,
  };

  return (
    <DeploySettingsContext.Provider value={value}>
      {children}
    </DeploySettingsContext.Provider>
  );
}
