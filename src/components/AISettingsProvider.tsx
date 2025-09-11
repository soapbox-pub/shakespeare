import { ReactNode, useState, useEffect } from 'react';
import { AISettingsContext, type AISettings, type AIConnection, type AISettingsContextType } from '@/contexts/AISettingsContext';

interface AISettingsProviderProps {
  children: ReactNode;
}

const DEFAULT_SETTINGS: AISettings = {
  providers: {},
  recentlyUsedModels: [],
};

const STORAGE_KEY = 'ai-settings';

export function AISettingsProvider({ children }: AISettingsProviderProps) {
  const [settings, setSettings] = useState<AISettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object' && 'providers' in parsed) {
          const settings = parsed as Partial<AISettings>;
          return {
            providers: settings.providers || {},
            recentlyUsedModels: settings.recentlyUsedModels || [],
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

  const addRecentlyUsedModel = (modelId: string) => {
    setSettings(prev => {
      const existingIndex = prev.recentlyUsedModels.indexOf(modelId);
      if (existingIndex === 0) {
        return prev;
      } else if (existingIndex === -1) {
        // Add new model to front, keep only last 10
        return {
          ...prev,
          recentlyUsedModels: [modelId, ...prev.recentlyUsedModels].slice(0, 10),
        }
      } else {
        // Move existing model to front
        return {
          ...prev,
          recentlyUsedModels: [
            modelId,
            ...prev.recentlyUsedModels.filter((_, index) => index !== existingIndex)
          ]
        }
      }
    });
  };

  const isConfigured = Object.entries(settings.providers).length > 0;

  const contextValue: AISettingsContextType = {
    settings,
    updateSettings,
    addProvider,
    removeProvider,
    updateProvider,
    addRecentlyUsedModel,
    isConfigured,
  };

  return (
    <AISettingsContext.Provider value={contextValue}>
      {children}
    </AISettingsContext.Provider>
  );
}