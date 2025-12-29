import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useGit } from './useGit';
import { useGitSyncState } from './useGitSyncState';

interface GitSyncResult {
  defaultBranch: string | null;
  fetchHead: string | null;
  fetchHeadDescription: string | null;
  didPull?: boolean;
  didPush?: boolean;
}

export function useGitSync(dir: string | undefined, remote = 'origin') {
  const { git } = useGit();
  const queryClient = useQueryClient();
  const { startOperation, endOperation } = useGitSyncState();

  const query = useQuery({
    queryKey: ['git-sync', dir],
    queryFn: async (): Promise<GitSyncResult> => {
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

        // Always fetch to update remote tracking
        startOperation(dir, 'fetch');
        const fetchResult = await git.fetch({
          dir,
          remote,
        });
        endOperation(dir);

        let didPull = false;
        let didPush = false;

        // If autosync is enabled, perform pull and push
        if (autosync === 'true') {
          try {
            // Get current branch
            const currentBranch = await git.currentBranch({ dir });

            if (currentBranch) {
              // Pull changes from remote
              try {
                startOperation(dir, 'pull');
                await git.pull({
                  dir,
                  ref: currentBranch,
                  singleBranch: true,
                });
                didPull = true;
                endOperation(dir);
              } catch (pullError) {
                endOperation(dir);
                // Pull might fail if there are conflicts or diverged branches
                // Don't throw - just log and continue
                console.warn('Auto-pull failed:', pullError);
              }

              // Push local changes to remote
              try {
                startOperation(dir, 'push');
                await git.push({
                  dir,
                  remote,
                  ref: currentBranch,
                });
                didPush = true;
                endOperation(dir);
              } catch (pushError) {
                endOperation(dir);
                // Push might fail if there are conflicts or no changes
                // Don't throw - just log and continue
                console.warn('Auto-push failed:', pushError);
              }

              // If we successfully synced, invalidate git status to refresh UI
              if (didPull || didPush) {
                const projectId = dir.split('/').pop();
                if (projectId) {
                  queryClient.invalidateQueries({ queryKey: ['git-status', projectId] });
                }
              }
            }
          } catch (error) {
            console.warn('Auto-sync failed:', error);
          }
        }

        return {
          ...fetchResult,
          didPull,
          didPush,
        };
      } catch (error) {
        endOperation(dir);
        // Fetch/sync failed, but don't throw - just log and return null
        console.warn('Git sync failed:', error);
        return {
          defaultBranch: null,
          fetchHead: null,
          fetchHeadDescription: null,
        };
      }
    },
    enabled: !!dir,
    refetchInterval: 60000, // Sync every 60 seconds
    staleTime: 30000, // Consider data stale after 30 seconds
    retry: false, // Don't retry on failure
  });

  return query;
}
