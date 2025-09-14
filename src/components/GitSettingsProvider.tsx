import { ReactNode, useState, useEffect } from 'react';
import { GitSettingsContext, type GitSettings, type GitCredential, type GitSettingsContextType } from '@/contexts/GitSettingsContext';

interface GitSettingsProviderProps {
  children: ReactNode;
}

const DEFAULT_SETTINGS: GitSettings = {
  credentials: {},
  corsProxy: 'https://cors.isomorphic-git.org',
};

const STORAGE_KEY = 'git-settings';

export function GitSettingsProvider({ children }: GitSettingsProviderProps) {
  const [settings, setSettings] = useState<GitSettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object' && 'credentials' in parsed) {
          const settings = parsed as Partial<GitSettings>;
          return {
            credentials: settings.credentials || {},
            corsProxy: settings.corsProxy || DEFAULT_SETTINGS.corsProxy,
          };
        }
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

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

  const isConfigured = Object.entries(settings.credentials).length > 0;

  const contextValue: GitSettingsContextType = {
    settings,
    updateSettings,
    addCredential,
    removeCredential,
    updateCredential,
    isConfigured,
  };

  return (
    <GitSettingsContext.Provider value={contextValue}>
      {children}
    </GitSettingsContext.Provider>
  );
}