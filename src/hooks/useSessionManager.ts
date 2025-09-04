import { useContext } from 'react';
import { SessionManagerContext } from '@/contexts/SessionManagerContext';

/**
 * Hook to access the global session manager
 */
export function useSessionManager() {
  const sessionManager = useContext(SessionManagerContext);
  
  if (!sessionManager) {
    throw new Error('useSessionManager must be used within a SessionManagerProvider');
  }
  
  return sessionManager;
}