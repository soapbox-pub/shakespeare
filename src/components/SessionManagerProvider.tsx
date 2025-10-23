import { ReactNode, useMemo, useEffect } from 'react';
import { SessionManagerContext } from '@/contexts/SessionManagerContext';
import { SessionManager } from '@/lib/SessionManager';
import { useFS } from '@/hooks/useFS';
import { useFSPaths } from '@/hooks/useFSPaths';
import { useAISettings } from '@/hooks/useAISettings';
import { useProviderModels } from '@/hooks/useProviderModels';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAppContext } from '@/hooks/useAppContext';

interface SessionManagerProviderProps {
  children: ReactNode;
}

/**
 * Provider that creates and manages the global session manager instance
 */
export function SessionManagerProvider({ children }: SessionManagerProviderProps) {
  const { fs } = useFS();
  const { projectsPath } = useFSPaths();
  const { settings } = useAISettings();
  const { models } = useProviderModels();
  const { user, metadata } = useCurrentUser();
  const { config } = useAppContext();

  const sessionManager = useMemo(() => {
    const getProviderModels = () => models;
    const getCurrentUser = () => ({ user, metadata });
    return new SessionManager(fs, settings, getProviderModels, getCurrentUser, config.corsProxy, projectsPath);
  }, [fs, settings, models, user, metadata, config.corsProxy, projectsPath]);

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