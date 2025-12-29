import { createContext } from 'react';

export type GitOperation = 'fetch' | 'pull' | 'push';

export interface GitSyncState {
  dir: string;
  operation: GitOperation;
  isActive: boolean;
  error?: Error;
}

export interface FetchResult {
  defaultBranch: string | null;
  fetchHead: string | null;
  fetchHeadDescription: string | null;
}

export interface GitSyncContextValue {
  // State access
  syncStates: Map<string, GitSyncState>;
  getState: (dir: string) => GitSyncState | undefined;
  getError: (dir: string) => Error | undefined;

  // Git operations
  fetch: (dir: string, remote?: string) => Promise<FetchResult>;
  pull: (dir: string, ref: string, remote?: string) => Promise<void>;
  push: (dir: string, ref: string, remote?: string, force?: boolean) => Promise<void>;
  sync: (dir: string, ref: string, remote?: string) => Promise<void>;
  forcePull: (dir: string, ref: string, remote?: string) => Promise<void>;
  forcePush: (dir: string, ref: string, remote?: string) => Promise<void>;

  // Internal state management (for backward compatibility during migration)
  startOperation: (dir: string, operation: GitOperation) => void;
  endOperation: (dir: string, error?: Error) => void;
  setError: (dir: string, error: Error | null) => void;
}

export const GitSyncContext = createContext<GitSyncContextValue | null>(null);
