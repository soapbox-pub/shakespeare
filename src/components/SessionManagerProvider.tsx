import { ReactNode, useMemo, useEffect } from 'react';
import { SessionManagerContext } from '@/contexts/SessionManagerContext';
import { SessionManager } from '@/lib/SessionManager';
import { useFS } from '@/hooks/useFS';
import { useAISettings } from '@/hooks/useAISettings';
import { useProviderModels } from '@/hooks/useProviderModels';

interface SessionManagerProviderProps {
  children: ReactNode;
}

/**
 * Provider that creates and manages the global session manager instance
 */
export function SessionManagerProvider({ children }: SessionManagerProviderProps) {
  const { fs } = useFS();
  const { settings } = useAISettings();
  const { models } = useProviderModels();

  const sessionManager = useMemo(() => {
    const getProviderModels = () => models;
    return new SessionManager(fs, settings, getProviderModels);
  }, [fs, settings, models]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Fire and forget cleanup - we don't need to await in useEffect cleanup
      sessionManager.cleanup().catch(error => {
        console.warn('Failed to cleanup session manager:', error);
      });
    };
  }, [sessionManager]);

  return (
    <SessionManagerContext.Provider value={sessionManager}>
      {children}
    </SessionManagerContext.Provider>
  );
}