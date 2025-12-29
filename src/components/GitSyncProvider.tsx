import { useState, useCallback, ReactNode } from 'react';
import { GitSyncContext, GitOperation, GitSyncState } from '@/contexts/GitSyncContext';

export function GitSyncProvider({ children }: { children: ReactNode }) {
  const [syncStates, setSyncStates] = useState<Map<string, GitSyncState>>(new Map());

  const startOperation = useCallback((dir: string, operation: GitOperation) => {
    setSyncStates(prev => {
      const next = new Map(prev);
      next.set(dir, { dir, operation, isActive: true });
      return next;
    });
  }, []);

  const endOperation = useCallback((dir: string) => {
    setSyncStates(prev => {
      const next = new Map(prev);
      next.delete(dir);
      return next;
    });
  }, []);

  const getState = useCallback((dir: string) => {
    return syncStates.get(dir);
  }, [syncStates]);

  return (
    <GitSyncContext.Provider value={{ syncStates, startOperation, endOperation, getState }}>
      {children}
    </GitSyncContext.Provider>
  );
}
