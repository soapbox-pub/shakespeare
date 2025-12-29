import { useState, useCallback, ReactNode, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { GitSyncContext, GitOperation, GitSyncState, FetchResult } from '@/contexts/GitSyncContext';
import { useGit } from '@/hooks/useGit';

export function GitSyncProvider({ children }: { children: ReactNode }) {
  const [syncStates, setSyncStates] = useState<Map<string, GitSyncState>>(new Map());
  const queryClient = useQueryClient();
  const { git } = useGit();

  // Track active operations to prevent concurrent operations on the same directory
  const activeOperations = useRef<Map<string, Promise<unknown>>>(new Map());

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

  // Helper to invalidate git status queries
  const invalidateGitStatus = useCallback((dir: string) => {
    const projectId = dir.split('/').pop();
    if (projectId) {
      queryClient.invalidateQueries({ queryKey: ['git-status', projectId] });
    }
  }, [queryClient]);

  // Helper to ensure only one operation runs at a time per directory
  const withOperationLock = useCallback(async <T,>(
    dir: string,
    operation: GitOperation,
    fn: () => Promise<T>
  ): Promise<T> => {
    // Check if there's already an active operation for this directory
    const existingOp = activeOperations.current.get(dir);
    if (existingOp) {
      // Wait for the existing operation to complete first
      await existingOp.catch(() => {
        // Ignore errors from previous operation
      });
    }

    // Start the new operation
    startOperation(dir, operation);
    setError(dir, null);

    const promise = fn()
      .then(result => {
        endOperation(dir);
        activeOperations.current.delete(dir);
        return result;
      })
      .catch(err => {
        const error = err instanceof Error ? err : new Error(`${operation} failed`);
        endOperation(dir, error);
        setError(dir, error);
        activeOperations.current.delete(dir);
        throw error;
      });

    activeOperations.current.set(dir, promise);
    return promise;
  }, [startOperation, endOperation, setError]);

  // Git operation: fetch
  const fetch = useCallback(async (dir: string, remote = 'origin'): Promise<FetchResult> => {
    return withOperationLock(dir, 'fetch', async () => {
      const fetchResult = await git.fetch({ dir, remote });
      invalidateGitStatus(dir);
      return fetchResult;
    });
  }, [git, withOperationLock, invalidateGitStatus]);

  // Git operation: pull
  const pull = useCallback(async (dir: string, ref: string, _remote = 'origin'): Promise<void> => {
    return withOperationLock(dir, 'pull', async () => {
      await git.pull({ dir, ref, singleBranch: true });
      invalidateGitStatus(dir);
    });
  }, [git, withOperationLock, invalidateGitStatus]);

  // Git operation: push
  const push = useCallback(async (dir: string, ref: string, remote = 'origin', force = false): Promise<void> => {
    return withOperationLock(dir, 'push', async () => {
      await git.push({ dir, remote, ref, force });
      invalidateGitStatus(dir);
    });
  }, [git, withOperationLock, invalidateGitStatus]);

  // Git operation: sync (pull then push)
  const sync = useCallback(async (dir: string, ref: string, remote = 'origin'): Promise<void> => {
    return withOperationLock(dir, 'pull', async () => {
      // Pull first
      await git.pull({ dir, ref, singleBranch: true });

      // Then push (update operation type)
      startOperation(dir, 'push');
      await git.push({ dir, remote, ref });

      invalidateGitStatus(dir);
    });
  }, [git, withOperationLock, invalidateGitStatus, startOperation]);

  // Git operation: force pull
  const forcePull = useCallback(async (dir: string, ref: string, remote = 'origin'): Promise<void> => {
    return withOperationLock(dir, 'pull', async () => {
      // Step 1: Fetch latest changes from remote
      await git.fetch({
        dir,
        remote,
        ref,
        singleBranch: true,
      });

      // Step 2: Get the remote commit SHA
      const remoteRef = `refs/remotes/${remote}/${ref}`;
      const remoteSha = await git.resolveRef({ dir, ref: remoteRef });

      // Step 3: Force update the current branch to point to remote
      await git.writeRef({
        dir,
        ref: `refs/heads/${ref}`,
        value: remoteSha,
        force: true,
      });

      // Step 4: Force checkout all files (overwrite local changes)
      await git.checkout({
        dir,
        ref,
        force: true,
      });

      invalidateGitStatus(dir);
    });
  }, [git, withOperationLock, invalidateGitStatus]);

  // Git operation: force push
  const forcePush = useCallback(async (dir: string, ref: string, remote = 'origin'): Promise<void> => {
    return withOperationLock(dir, 'push', async () => {
      await git.push({ dir, remote, ref, force: true });
      invalidateGitStatus(dir);
    });
  }, [git, withOperationLock, invalidateGitStatus]);

  return (
    <GitSyncContext.Provider value={{
      syncStates,
      getState,
      getError,
      fetch,
      pull,
      push,
      sync,
      forcePull,
      forcePush,
      startOperation,
      endOperation,
      setError,
    }}>
      {children}
    </GitSyncContext.Provider>
  );
}
