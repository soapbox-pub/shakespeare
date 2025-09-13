import { useContext } from 'react';
import { GitSettingsContext, type GitSettingsContextType } from '@/contexts/GitSettingsContext';

/**
 * Hook to access and update Git settings
 * @returns Git settings context with settings and update methods
 */
export function useGitSettings(): GitSettingsContextType {
  const context = useContext(GitSettingsContext);
  if (!context) {
    throw new Error('useGitSettings must be used within GitSettingsProvider');
  }
  return context;
}