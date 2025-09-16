import { useQueryClient } from '@tanstack/react-query';
import { ReactNode, useState, useEffect } from 'react';
import { AISettingsContext, type AISettings, type AIConnection, type AISettingsContextType } from '@/contexts/AISettingsContext';
import { useFS } from '@/hooks/useFS';
import { readAISettings, writeAISettings } from '@/lib/configUtils';

interface AISettingsProviderProps {
  children: ReactNode;
}

const DEFAULT_SETTINGS: AISettings = {
  providers: {},
  recentlyUsedModels: [],
};

export function AISettingsProvider({ children }: AISettingsProviderProps) {
  const queryClient = useQueryClient();
  const { fs } = useFS();
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize settings from VFS on mount
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        const settings = await readAISettings(fs);
        setSettings(settings);
      } catch (error) {
        console.error('Failed to initialize AI settings:', error);
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
        await writeAISettings(fs, settings);
      } catch (error) {
        console.error('Failed to save AI settings:', error);
      }
    };

    saveSettings();
  }, [fs, settings, isInitialized]);

  const updateSettings = (newSettings: Partial<AISettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));

    // If providers are being updated, invalidate the provider-models query
    if ('providers' in newSettings) {
      queryClient.invalidateQueries({ queryKey: ['provider-models'] });
    }
  };

  const addProvider = (name: string, connection: AIConnection) => {
    setSettings(prev => ({
      ...prev,
      providers: {
        ...prev.providers,
        [name]: connection,
      },
    }));
    queryClient.invalidateQueries({ queryKey: ['provider-models'] });
  };

  const removeProvider = (name: string) => {
    setSettings(prev => {
      const { [name]: removed, ...rest } = prev.providers;
      return {
        ...prev,
        providers: rest,
      };
    });
    queryClient.invalidateQueries({ queryKey: ['provider-models'] });
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
    queryClient.invalidateQueries({ queryKey: ['provider-models'] });
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