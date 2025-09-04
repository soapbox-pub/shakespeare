import { ReactNode, useMemo, useEffect } from 'react';
import { SessionManagerContext } from '@/contexts/SessionManagerContext';
import { SessionManager } from '@/lib/SessionManager';
import { useFS } from '@/hooks/useFS';
import { useAISettings } from '@/hooks/useAISettings';

interface SessionManagerProviderProps {
  children: ReactNode;
}

/**
 * Provider that creates and manages the global session manager instance
 */
export function SessionManagerProvider({ children }: SessionManagerProviderProps) {
  const { fs } = useFS();
  const { settings } = useAISettings();

  const sessionManager = useMemo(() => {
    return new SessionManager(fs, settings);
  }, [fs, settings]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sessionManager.cleanup();
    };
  }, [sessionManager]);

  return (
    <SessionManagerContext.Provider value={sessionManager}>
      {children}
    </SessionManagerContext.Provider>
  );
}