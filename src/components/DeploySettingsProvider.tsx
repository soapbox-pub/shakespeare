import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { DeploySettingsContext, type DeploySettings, type DeployProvider } from '@/contexts/DeploySettingsContext';
import { useFS } from '@/hooks/useFS';
import { readDeploySettings, writeDeploySettings } from '@/lib/configUtils';

const DEFAULT_SETTINGS: DeploySettings = {
  providers: [],
};

export function DeploySettingsProvider({ children }: { children: ReactNode }) {
  const { fs } = useFS();
  const [settings, setSettings] = useState<DeploySettings>(DEFAULT_SETTINGS);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize settings from VFS on mount
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        const settings = await readDeploySettings(fs);
        setSettings(settings);
      } catch (error) {
        console.error('Failed to initialize deploy settings:', error);
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setIsInitialized(true);
      }
    };

    initializeSettings();
  }, [fs]);

  // Save settings to VFS whenever they change (but not during initialization)
  useEffect(() => {
    if (!isInitialized) return;

    const saveSettings = async () => {
      try {
        await writeDeploySettings(fs, settings);
      } catch (error) {
        console.error('Failed to save deploy settings:', error);
      }
    };

    saveSettings();
  }, [fs, settings, isInitialized]);

  const updateSettings = (updates: Partial<DeploySettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const removeProvider = (index: number) => {
    setSettings(prev => ({
      ...prev,
      providers: prev.providers.filter((_, i) => i !== index),
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
