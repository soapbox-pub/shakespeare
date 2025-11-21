import { useQueryClient } from '@tanstack/react-query';
import { ReactNode, useState, useEffect } from 'react';
import { AISettingsContext, type AISettings, type AIProvider, type MCPServer, type AISettingsContextType } from '@/contexts/AISettingsContext';
import { useFS } from '@/hooks/useFS';
import { useFSPaths } from '@/hooks/useFSPaths';
import { readAISettings, writeAISettings } from '@/lib/configUtils';

interface AISettingsProviderProps {
  children: ReactNode;
}

const DEFAULT_SETTINGS: AISettings = {
  providers: [],
  recentlyUsedModels: [],
  mcpServers: {},
};

export function AISettingsProvider({ children }: AISettingsProviderProps) {
  const queryClient = useQueryClient();
  const { fs } = useFS();
  const { configPath } = useFSPaths();
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize settings from VFS on mount
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        const settings = await readAISettings(fs, configPath);
        setSettings(settings);
      } catch (error) {
        console.error('Failed to initialize AI settings:', error);
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
        await writeAISettings(fs, settings, configPath);
      } catch (error) {
        console.error('Failed to save AI settings:', error);
      }
    };

    saveSettings();
  }, [fs, settings, isInitialized, configPath]);

  const updateSettings = (newSettings: Partial<AISettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));

    // If providers are being updated, invalidate the provider-models query
    if ('providers' in newSettings) {
      queryClient.invalidateQueries({ queryKey: ['provider-models'] });
      queryClient.invalidateQueries({ queryKey: ['ai-credits'] });
    }
  };

  const setProvider = (provider: AIProvider) => {
    setSettings(prev => {
      const existingIndex = prev.providers.findIndex(p => p.id === provider.id);
      if (existingIndex >= 0) {
        // Update existing provider
        return {
          ...prev,
          providers: prev.providers.map(p =>
            p.id === provider.id ? provider : p
          ),
        };
      } else {
        // Add new provider
        return {
          ...prev,
          providers: [...prev.providers, provider],
        };
      }
    });
    queryClient.invalidateQueries({ queryKey: ['provider-models'] });
    queryClient.invalidateQueries({ queryKey: ['ai-credits'] });
  };

  const removeProvider = (id: string) => {
    setSettings(prev => ({
      ...prev,
      providers: prev.providers.filter(provider => provider.id !== id),
    }));
    queryClient.invalidateQueries({ queryKey: ['provider-models'] });
    queryClient.invalidateQueries({ queryKey: ['ai-credits'] });
  };

  const setProviders = (providers: AIProvider[]) => {
    setSettings(prev => ({
      ...prev,
      providers,
    }));
    queryClient.invalidateQueries({ queryKey: ['provider-models'] });
    queryClient.invalidateQueries({ queryKey: ['ai-credits'] });
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

  const setMCPServer = (name: string, server: MCPServer) => {
    setSettings(prev => ({
      ...prev,
      mcpServers: {
        ...(prev.mcpServers || {}),
        [name]: server,
      },
    }));
  };

  const removeMCPServer = (name: string) => {
    setSettings(prev => {
      const newMCPServers = { ...(prev.mcpServers || {}) };
      delete newMCPServers[name];
      return {
        ...prev,
        mcpServers: newMCPServers,
      };
    });
  };

  const isConfigured = settings.providers.length > 0;

  const contextValue: AISettingsContextType = {
    settings,
    updateSettings,
    setProvider,
    removeProvider,
    setProviders,
    addRecentlyUsedModel,
    setMCPServer,
    removeMCPServer,
    isConfigured,
  };

  return (
    <AISettingsContext.Provider value={contextValue}>
      {children}
    </AISettingsContext.Provider>
  );
}