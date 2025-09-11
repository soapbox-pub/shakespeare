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
      const projectSessions = sessionManager.getProjectSessions(projectId);
      const runningSessions = projectSessions.filter(session => session.isLoading);

      setHasActiveSessions(projectSessions.length > 0);
      setHasRunningSessions(runningSessions.length > 0);
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