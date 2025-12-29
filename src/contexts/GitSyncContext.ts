import { createContext } from 'react';

export type GitOperation = 'fetch' | 'pull' | 'push';

export interface GitSyncState {
  dir: string;
  operation: GitOperation;
  isActive: boolean;
}

export interface GitSyncContextValue {
  syncStates: Map<string, GitSyncState>;
  startOperation: (dir: string, operation: GitOperation) => void;
  endOperation: (dir: string) => void;
  getState: (dir: string) => GitSyncState | undefined;
}

export const GitSyncContext = createContext<GitSyncContextValue | null>(null);
