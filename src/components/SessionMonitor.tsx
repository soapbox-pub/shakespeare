import { useEffect, useRef } from 'react';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useToast } from '@/hooks/useToast';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Global component that monitors AI sessions and shows notifications
 * when sessions complete in the background
 */
export function SessionMonitor() {
  const sessionManager = useSessionManager();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const previousLoadingStates = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    const handleLoadingChanged = (sessionId: string, isLoading: boolean) => {
      const wasLoading = previousLoadingStates.current.get(sessionId);
      previousLoadingStates.current.set(sessionId, isLoading);

      // If session just finished loading (was loading, now not loading)
      if (wasLoading && !isLoading) {
        const session = sessionManager.getSession(sessionId);
        if (!session) return;

        // Check if user is currently viewing this project
        const currentProjectId = location.pathname.split('/')[2]; // /project/{projectId}
        const isCurrentProject = session.projectId === currentProjectId;

        // Only show notification if user is not currently viewing this project
        if (!isCurrentProject) {
          toast({
            title: "AI Session Complete",
            description: `Finished working on ${session.projectName}`,
            action: (
              <button
                onClick={() => navigate(`/project/${session.projectId}`)}
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus-visible:ring-destructive"
              >
                View
              </button>
            )
          });
        }
      }
    };

    const handleSessionCreated = (sessionId: string) => {
      const session = sessionManager.getSession(sessionId);
      if (session) {
        previousLoadingStates.current.set(sessionId, session.isLoading);
      }
    };

    const handleSessionDeleted = (sessionId: string) => {
      previousLoadingStates.current.delete(sessionId);
    };

    // Initialize with current sessions
    sessionManager.getAllSessions().forEach(session => {
      previousLoadingStates.current.set(session.id, session.isLoading);
    });

    // Subscribe to events
    sessionManager.on('loadingChanged', handleLoadingChanged);
    sessionManager.on('sessionCreated', handleSessionCreated);
    sessionManager.on('sessionDeleted', handleSessionDeleted);

    return () => {
      sessionManager.off('loadingChanged', handleLoadingChanged);
      sessionManager.off('sessionCreated', handleSessionCreated);
      sessionManager.off('sessionDeleted', handleSessionDeleted);
    };
  }, [sessionManager, toast, navigate, location.pathname]);

  // This component doesn't render anything
  return null;
}