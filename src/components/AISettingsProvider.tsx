import { ReactNode, useState, useEffect } from 'react';
import { AISettingsContext, type AISettings, type AIConnection, type AISettingsContextType } from '@/contexts/AISettingsContext';

interface AISettingsProviderProps {
  children: ReactNode;
}

const DEFAULT_SETTINGS: AISettings = {
  providers: {},
};

const STORAGE_KEY = 'ai-settings';

function migrateOldSettings(stored: unknown): AISettings {
  // Handle migration from old single-provider format
  if (stored && typeof stored === 'object' && 'apiKey' in stored && 'baseUrl' in stored) {
    const oldSettings = stored as { apiKey?: string; baseUrl?: string };
    return {
      providers: {
        openrouter: {
          baseURL: oldSettings.baseUrl || 'https://openrouter.ai/api/v1',
          apiKey: oldSettings.apiKey || '',
        },
      },
    };
  }
  // If it's already the new format or invalid, return as AISettings or default
  if (stored && typeof stored === 'object' && 'providers' in stored) {
    return stored as AISettings;
  }
  return DEFAULT_SETTINGS;
}

export function AISettingsProvider({ children }: AISettingsProviderProps) {
  const [settings, setSettings] = useState<AISettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const migrated = migrateOldSettings(parsed);
        return { ...DEFAULT_SETTINGS, ...migrated };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (newSettings: Partial<AISettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const addProvider = (name: string, connection: AIConnection) => {
    setSettings(prev => ({
      ...prev,
      providers: {
        ...prev.providers,
        [name]: connection,
      },
    }));
  };

  const removeProvider = (name: string) => {
    setSettings(prev => {
      const { [name]: removed, ...rest } = prev.providers;
      return {
        ...prev,
        providers: rest,
      };
    });
  };

  const updateProvider = (name: string, connection: Partial<AIConnection>) => {
    setSettings(prev => ({
      ...prev,
      providers: {
        ...prev.providers,
        [name]: {
          ...prev.providers[name],
          ...connection,
        },
      },
    }));
  };

  const isConfigured = Object.entries(settings.providers).length > 0;

  const contextValue: AISettingsContextType = {
    settings,
    updateSettings,
    addProvider,
    removeProvider,
    updateProvider,
    isConfigured,
  };

  return (
    <AISettingsContext.Provider value={contextValue}>
      {children}
    </AISettingsContext.Provider>
  );
}