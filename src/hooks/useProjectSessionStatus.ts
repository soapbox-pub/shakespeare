import { useState, useEffect } from 'react';
import { useSessionManager } from '@/hooks/useSessionManager';

/**
 * Hook to get session status for a specific project
 */
export function useProjectSessionStatus(projectId: string) {
  const sessionManager = useSessionManager();
  const [hasActiveSessions, setHasActiveSessions] = useState(false);
  const [hasRunningSessions, setHasRunningSessions] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      const projectSession = sessionManager.getProjectSession(projectId);

      setHasActiveSessions(!!projectSession);
      setHasRunningSessions(!!projectSession?.isLoading);
    };

    // Initial update
    updateStatus();

    // Subscribe to session changes
    sessionManager.on('sessionCreated', updateStatus);
    sessionManager.on('sessionDeleted', updateStatus);
    sessionManager.on('loadingChanged', updateStatus);

    return () => {
      sessionManager.off('sessionCreated', updateStatus);
      sessionManager.off('sessionDeleted', updateStatus);
      sessionManager.off('loadingChanged', updateStatus);
    };
  }, [sessionManager, projectId]);

  return {
    hasActiveSessions,
    hasRunningSessions
  };
}