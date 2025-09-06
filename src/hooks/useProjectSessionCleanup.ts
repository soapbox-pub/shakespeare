import { useEffect } from 'react';
import { useSessionManager } from '@/hooks/useSessionManager';

/**
 * Hook to clean up sessions when projects are deleted or components unmount
 */
export function useProjectSessionCleanup(projectId: string) {
  const sessionManager = useSessionManager();

  useEffect(() => {
    // Cleanup function that runs when the project component unmounts
    // or when the projectId changes
    return () => {
      // Note: We don't auto-cleanup sessions when navigating away from a project
      // since we want sessions to persist in the background. Sessions are only
      // cleaned up when explicitly deleted or when the project is deleted.
    };
  }, [projectId, sessionManager]);

  // Return a cleanup function that can be called when a project is deleted
  const cleanupProjectSessions = async () => {
    await sessionManager.deleteProjectSessions(projectId);
  };

  return { cleanupProjectSessions };
}