import { useEffect } from 'react';
import { useSessionManager } from './useSessionManager';
import type { SessionManagerEvents } from '@/lib/SessionManager';

/**
 * Custom hook for subscribing to SessionManager events with automatic cleanup
 */
export function useSessionSubscription<K extends keyof SessionManagerEvents>(
  event: K,
  handler: SessionManagerEvents[K],
  deps: React.DependencyList = []
): void {
  const sessionManager = useSessionManager();

  useEffect(() => {
    sessionManager.on(event, handler);

    return () => {
      sessionManager.off(event, handler);
    };
  }, [sessionManager, event, handler, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
}