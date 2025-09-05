import { useEffect, useRef } from 'react';
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

  // Use a ref to track the current handler and deps
  const handlerRef = useRef(handler);
  const depsRef = useRef(deps);

  // Update refs when handler or deps change
  useEffect(() => {
    handlerRef.current = handler;
    depsRef.current = deps;
  }, [handler, deps]);

  useEffect(() => {
    const currentHandler = handlerRef.current;
    sessionManager.on(event, currentHandler);

    return () => {
      sessionManager.off(event, currentHandler);
    };
  }, [sessionManager, event]);
}