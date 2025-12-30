import { useQuery } from '@tanstack/react-query';
import { useGit } from './useGit';
import { useGitSyncState } from './useGitSyncState';
import { useProjectSessionStatus } from './useProjectSessionStatus';

interface GitSyncResult {
  defaultBranch: string | null;
  fetchHead: string | null;
  fetchHeadDescription: string | null;
  didPull?: boolean;
  didPush?: boolean;
}

export function useGitSync(dir: string | undefined, remote = 'origin') {
  const { git } = useGit();
  const gitSync = useGitSyncState();

  // Extract project ID from directory path
  const projectId = dir?.split('/').pop() || '';
  const { hasRunningSessions } = useProjectSessionStatus(projectId);

  const query = useQuery({
    queryKey: ['git-sync', dir],
    queryFn: async (): Promise<GitSyncResult> => {
      // Don't sync if project is currently generating
      if (hasRunningSessions) {
        return {
          defaultBranch: null,
          fetchHead: null,
          fetchHeadDescription: null,
        };
      }
      const remotes = await git.listRemotes({ dir });
      const hasOrigin = !!remotes.find(r => r.remote === remote);

      if (!dir || !hasOrigin) {
        return {
          defaultBranch: null,
          fetchHead: null,
          fetchHeadDescription: null,
        };
      }

      try {
        // Check if autosync is enabled
        const autosync = await git.getConfig({
          dir,
          path: 'shakespeare.autosync',
        });

        let didPull = false;
        let didPush = false;

        // If autosync is enabled, perform pull and push
        // (pull does fetch internally, so no separate fetch needed)
        if (autosync === 'true') {
          try {
            // Get current branch
            const currentBranch = await git.currentBranch({ dir });

            if (currentBranch) {
              // Pull changes from remote (this does fetch internally)
              try {
                await gitSync.pull(dir, currentBranch, remote);
                didPull = true;
                // Clear any previous errors on successful pull
                gitSync.setError(dir, null);
              } catch (pullError) {
                // Pull might fail if there are conflicts or diverged branches
                // Error is already set by the provider - just log and continue
                console.warn('Auto-pull failed:', pullError);
              }

              // Push local changes to remote
              try {
                await gitSync.push(dir, currentBranch, remote);
                didPush = true;
                // Clear any previous errors on successful push
                gitSync.setError(dir, null);
              } catch (pushError) {
                // Push might fail if there are conflicts or no changes
                // Error is already set by the provider - just log and continue
                console.warn('Auto-push failed:', pushError);
              }
            }
          } catch (error) {
            // Error getting current branch or other unexpected error
            console.warn('Auto-sync failed:', error);
          }

          // Return result without fetch data since pull already fetched
          return {
            defaultBranch: null,
            fetchHead: null,
            fetchHeadDescription: null,
            didPull,
            didPush,
          };
        } else {
          // Only fetch when autosync is not enabled (since pull isn't being called)
          const fetchResult = await gitSync.fetch(dir, remote);
          return {
            ...fetchResult,
            didPull,
            didPush,
          };
        }
      } catch (error) {
        // Fetch/sync failed, but don't throw - just log and return null
        // Error is already set by the provider
        console.warn('Git sync failed:', error);
        return {
          defaultBranch: null,
          fetchHead: null,
          fetchHeadDescription: null,
        };
      }
    },
    enabled: !!dir && !hasRunningSessions, // Don't sync while project is generating
    refetchInterval: 5 * 60 * 1000, // Sync every 5 minutes
    staleTime: 1 * 60 * 1000, // Consider data stale after 1 minute
    retry: false, // Don't retry on failure
  });

  return query;
}
