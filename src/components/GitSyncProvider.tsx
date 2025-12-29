import { useState, useCallback, ReactNode } from 'react';
import { GitSyncContext, GitOperation, GitSyncState } from '@/contexts/GitSyncContext';

export function GitSyncProvider({ children }: { children: ReactNode }) {
  const [syncStates, setSyncStates] = useState<Map<string, GitSyncState>>(new Map());

  const startOperation = useCallback((dir: string, operation: GitOperation) => {
    setSyncStates(prev => {
      const next = new Map(prev);
      // Clear any previous error when starting a new operation
      next.set(dir, { dir, operation, isActive: true });
      return next;
    });
  }, []);

  const endOperation = useCallback((dir: string, error?: Error) => {
    setSyncStates(prev => {
      const next = new Map(prev);
      if (error) {
        // Keep the state with the error
        const currentState = prev.get(dir);
        if (currentState) {
          next.set(dir, { ...currentState, isActive: false, error });
        }
      } else {
        // Remove the state if no error
        next.delete(dir);
      }
      return next;
    });
  }, []);

  const setError = useCallback((dir: string, error: Error | null) => {
    setSyncStates(prev => {
      const next = new Map(prev);
      const currentState = prev.get(dir);

      if (error) {
        // Set or update error
        if (currentState) {
          next.set(dir, { ...currentState, error });
        } else {
          // Create a new state with just the error (no active operation)
          next.set(dir, { dir, operation: 'fetch', isActive: false, error });
        }
      } else {
        // Clear error
        if (currentState) {
          const { error: _, ...stateWithoutError } = currentState;
          if (stateWithoutError.isActive) {
            next.set(dir, stateWithoutError);
          } else {
            // If not active and no error, remove the state entirely
            next.delete(dir);
          }
        }
      }

      return next;
    });
  }, []);

  const getState = useCallback((dir: string) => {
    return syncStates.get(dir);
  }, [syncStates]);

  const getError = useCallback((dir: string) => {
    return syncStates.get(dir)?.error;
  }, [syncStates]);

  return (
    <GitSyncContext.Provider value={{ syncStates, startOperation, endOperation, setError, getState, getError }}>
      {children}
    </GitSyncContext.Provider>
  );
}
