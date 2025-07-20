import { useContext } from 'react';
import { AISettingsContext, type AISettingsContextType } from '@/contexts/AISettingsContext';

/**
 * Hook to access and update AI settings
 * @returns AI settings context with settings and update methods
 */
export function useAISettings(): AISettingsContextType {
  const context = useContext(AISettingsContext);
  if (!context) {
    throw new Error('useAISettings must be used within AISettingsProvider');
  }
  return context;
}