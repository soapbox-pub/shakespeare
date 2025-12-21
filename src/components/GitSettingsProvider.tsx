import { ReactNode, useState, useEffect } from 'react';
import { GitSettingsContext, type GitSettings, type GitCredential, type GitSettingsContextType } from '@/contexts/GitSettingsContext';
import { useFS } from '@/hooks/useFS';
import { useFSPaths } from '@/hooks/useFSPaths';
import { readGitSettings, writeGitSettings } from '@/lib/configUtils';

interface GitSettingsProviderProps {
  children: ReactNode;
}

const DEFAULT_SETTINGS: GitSettings = {
  credentials: [],
};

export function GitSettingsProvider({ children }: GitSettingsProviderProps) {
  const { fs } = useFS();
  const { configPath } = useFSPaths();
  const [settings, setSettings] = useState<GitSettings>(DEFAULT_SETTINGS);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize settings from VFS on mount
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        const settings = await readGitSettings(fs, configPath);
        setSettings(settings);
      } catch (error) {
        console.error('Failed to initialize Git settings:', error);
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
        await writeGitSettings(fs, settings, configPath);
      } catch (error) {
        console.error('Failed to save Git settings:', error);
      }
    };

    saveSettings();
  }, [fs, settings, isInitialized, configPath]);

  const updateSettings = (newSettings: Partial<GitSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const addCredential = (credential: GitCredential) => {
    setSettings(prev => ({
      ...prev,
      credentials: [...prev.credentials, credential],
    }));
  };

  const removeCredential = (index: number) => {
    setSettings(prev => ({
      ...prev,
      credentials: prev.credentials.filter((_, i) => i !== index),
    }));
  };

  const updateCredential = (index: number, credential: Partial<GitCredential>) => {
    setSettings(prev => {
      const newCredentials = [...prev.credentials];
      newCredentials[index] = {
        ...newCredentials[index],
        ...credential,
      };
      return {
        ...prev,
        credentials: newCredentials,
      };
    });
  };

  const setCredentials = (credentials: GitCredential[]) => {
    setSettings(prev => ({
      ...prev,
      credentials,
    }));
  };

  const isConfigured = settings.credentials.length > 0;

  const contextValue: GitSettingsContextType = {
    settings,
    updateSettings,
    addCredential,
    removeCredential,
    updateCredential,
    setCredentials,
    isConfigured,
    isInitialized,
  };

  return (
    <GitSettingsContext.Provider value={contextValue}>
      {children}
    </GitSettingsContext.Provider>
  );
}