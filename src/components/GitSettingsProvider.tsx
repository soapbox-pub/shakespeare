import { ReactNode, useState, useEffect } from 'react';
import { GitSettingsContext, type GitSettings, type GitCredential, type GitHostToken, type GitSettingsContextType } from '@/contexts/GitSettingsContext';
import { useFS } from '@/hooks/useFS';
import { readGitSettings, writeGitSettings } from '@/lib/configUtils';

interface GitSettingsProviderProps {
  children: ReactNode;
}

const DEFAULT_SETTINGS: GitSettings = {
  credentials: {},
  hostTokens: {},
};

export function GitSettingsProvider({ children }: GitSettingsProviderProps) {
  const { fs } = useFS();
  const [settings, setSettings] = useState<GitSettings>(DEFAULT_SETTINGS);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize settings from VFS on mount
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        const settings = await readGitSettings(fs);
        setSettings(settings);
      } catch (error) {
        console.error('Failed to initialize Git settings:', error);
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
        await writeGitSettings(fs, settings);
      } catch (error) {
        console.error('Failed to save Git settings:', error);
      }
    };

    saveSettings();
  }, [fs, settings, isInitialized]);

  const updateSettings = (newSettings: Partial<GitSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const addCredential = (origin: string, credential: GitCredential) => {
    setSettings(prev => ({
      ...prev,
      credentials: {
        ...prev.credentials,
        [origin]: credential,
      },
    }));
  };

  const removeCredential = (origin: string) => {
    setSettings(prev => {
      const { [origin]: removed, ...rest } = prev.credentials;
      return {
        ...prev,
        credentials: rest,
      };
    });
  };

  const updateCredential = (origin: string, credential: Partial<GitCredential>) => {
    setSettings(prev => ({
      ...prev,
      credentials: {
        ...prev.credentials,
        [origin]: {
          ...prev.credentials[origin],
          ...credential,
        },
      },
    }));
  };

  const addHostToken = (host: string, token: GitHostToken) => {
    setSettings(prev => ({
      ...prev,
      hostTokens: {
        ...prev.hostTokens,
        [host]: token,
      },
    }));
  };

  const removeHostToken = (host: string) => {
    setSettings(prev => {
      const { [host]: removed, ...rest } = prev.hostTokens;
      return {
        ...prev,
        hostTokens: rest,
      };
    });
  };

  const updateHostToken = (host: string, token: Partial<GitHostToken>) => {
    setSettings(prev => ({
      ...prev,
      hostTokens: {
        ...prev.hostTokens,
        [host]: {
          ...prev.hostTokens[host],
          ...token,
        },
      },
    }));
  };

  const isConfigured = Object.entries(settings.credentials).length > 0;

  const contextValue: GitSettingsContextType = {
    settings,
    updateSettings,
    addCredential,
    removeCredential,
    updateCredential,
    addHostToken,
    removeHostToken,
    updateHostToken,
    isConfigured,
    isInitialized,
  };

  return (
    <GitSettingsContext.Provider value={contextValue}>
      {children}
    </GitSettingsContext.Provider>
  );
}