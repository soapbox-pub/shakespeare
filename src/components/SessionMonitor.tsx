import { useEffect, useRef } from 'react';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useToast } from '@/hooks/useToast';
import { useNavigate, useLocation } from 'react-router';
import { OPEN_PROJECT_EVENT } from '@/lib/agent/protocol';

/** The web's Launch Handling API, which the DOM lib doesn't declare yet. */
interface LaunchQueue {
  setConsumer(consumer: (params: { targetURL?: string }) => void): void;
}

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
    const handleLoadingChanged = (projectId: string, isLoading: boolean) => {
      const wasLoading = previousLoadingStates.current.get(projectId);
      previousLoadingStates.current.set(projectId, isLoading);

      // If session just finished loading (was loading, now not loading)
      if (wasLoading && !isLoading) {
        const session = sessionManager.getSession(projectId);
        if (!session) return;

        // Check if user is currently viewing this project
        const currentProjectId = location.pathname.split('/')[2]; // /project/{projectId}
        const isCurrentProject = session.projectId === currentProjectId;

        // Only show notification if user is not currently viewing this project
        if (!isCurrentProject) {
          toast({
            title: "AI Session Complete",
            description: `Finished working on ${session.projectId}`,
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

    const handleSessionCreated = (projectId: string) => {
      const session = sessionManager.getSession(projectId);
      if (session) {
        previousLoadingStates.current.set(projectId, session.isLoading);
      }
    };

    const handleSessionDeleted = (projectId: string) => {
      previousLoadingStates.current.delete(projectId);
    };

    // Initialize with current sessions
    sessionManager.getAllSessions().forEach(session => {
      previousLoadingStates.current.set(session.projectId, session.isLoading);
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

  // A click on a project's notification from the service worker shows that project
  useEffect(() => {
    const handleOpenProject = (event: Event) => {
      const { projectId } = (event as CustomEvent<{ projectId: string }>).detail;
      navigate(`/project/${projectId}`);
    };
    window.addEventListener(OPEN_PROJECT_EVENT, handleOpenProject);
    return () => window.removeEventListener(OPEN_PROJECT_EVENT, handleOpenProject);
  }, [navigate]);

  // A window Din opens for the service worker (a click on a finished task's notification, with no
  // window open) starts at the start page, with where to go in its launch's `url` parameter.
  useEffect(() => {
    const launchQueue = (window as { launchQueue?: LaunchQueue }).launchQueue;
    launchQueue?.setConsumer(({ targetURL }) => {
      if (!targetURL) return;
      const url = new URL(targetURL).searchParams.get('url');
      if (!url) return;
      const target = new URL(url, window.location.href);
      if (target.origin !== window.location.origin || target.pathname === window.location.pathname) return;
      navigate(target.pathname + target.search + target.hash);
    });
  }, [navigate]);

  // This component doesn't render anything
  return null;
}