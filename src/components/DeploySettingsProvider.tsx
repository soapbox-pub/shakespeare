import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { DeploySettingsContext, type DeploySettings, type DeployProvider } from '@/contexts/DeploySettingsContext';
import { useFS } from '@/hooks/useFS';
import { useFSPaths } from '@/hooks/useFSPaths';
import { readDeploySettings, writeDeploySettings } from '@/lib/configUtils';

const DEFAULT_SETTINGS: DeploySettings = {
  providers: [],
};

export function DeploySettingsProvider({ children }: { children: ReactNode }) {
  const { fs } = useFS();
  const { configPath } = useFSPaths();
  const [settings, setSettings] = useState<DeploySettings>(DEFAULT_SETTINGS);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize settings from VFS on mount
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        const settings = await readDeploySettings(fs, configPath);
        setSettings(settings);
      } catch (error) {
        console.error('Failed to initialize deploy settings:', error);
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setIsInitialized(true);
      }
    };

    initializeSettings();
  }, [fs, configPath]);

  // Save settings to VFS whenever they change (but not during initialization)
  useEffect(() => {
    if (!isInitialized) return;

    const saveSettings = async () => {
      try {
        await writeDeploySettings(fs, settings, configPath);
      } catch (error) {
        console.error('Failed to save deploy settings:', error);
      }
    };

    saveSettings();
  }, [fs, settings, isInitialized, configPath]);

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
    isInitialized,
  };

  return (
    <DeploySettingsContext.Provider value={value}>
      {children}
    </DeploySettingsContext.Provider>
  );
}
