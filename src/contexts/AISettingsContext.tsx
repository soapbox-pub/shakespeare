import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface AISettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface AISettingsContextType {
  settings: AISettings;
  updateSettings: (settings: Partial<AISettings>) => void;
  isConfigured: boolean;
}

const AISettingsContext = createContext<AISettingsContextType | undefined>(undefined);

const DEFAULT_SETTINGS: AISettings = {
  apiKey: '',
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'anthropic/claude-sonnet-4',
};

const STORAGE_KEY = 'ai-settings';

export function AISettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AISettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
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

  const isConfigured = Boolean(settings.apiKey);

  return (
    <AISettingsContext.Provider value={{ settings, updateSettings, isConfigured }}>
      {children}
    </AISettingsContext.Provider>
  );
}


export function useAISettings() {
  const context = useContext(AISettingsContext);
  if (!context) {
    throw new Error('useAISettings must be used within AISettingsProvider');
  }
  return context;
}
