import { createContext } from 'react';

export type GitOperation = 'fetch' | 'pull' | 'push';

export interface GitSyncState {
  dir: string;
  operation: GitOperation;
  isActive: boolean;
  error?: Error;
}

export interface GitSyncContextValue {
  syncStates: Map<string, GitSyncState>;
  startOperation: (dir: string, operation: GitOperation) => void;
  endOperation: (dir: string, error?: Error) => void;
  setError: (dir: string, error: Error | null) => void;
  getState: (dir: string) => GitSyncState | undefined;
  getError: (dir: string) => Error | undefined;
}

export const GitSyncContext = createContext<GitSyncContextValue | null>(null);
