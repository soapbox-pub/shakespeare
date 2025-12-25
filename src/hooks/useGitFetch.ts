import { useQuery } from '@tanstack/react-query';
import { useGit } from './useGit';

interface GitFetchResult {
  defaultBranch: string | null;
  fetchHead: string | null;
  fetchHeadDescription: string | null;
}

export function useGitFetch(dir: string | undefined, remote = 'origin') {
  const { git } = useGit();

  const query = useQuery({
    queryKey: ['git-fetch', dir],
    queryFn: async (): Promise<GitFetchResult> => {
      const remotes = await git.listRemotes({ dir });
      const hasOrigin = !!remotes.find(r => r.remote === remote);

      if (dir && hasOrigin) {
        try {
          return await git.fetch({
            dir,
            remote,
          });
        } catch (error) {
          // Fetch failed, but don't throw - just log and return null
          console.warn('Git fetch failed:', error);
        }
      }

      return {
        defaultBranch: null,
        fetchHead: null,
        fetchHeadDescription: null,
      };
    },
    enabled: !!dir,
    refetchInterval: 60000, // Fetch every 60 seconds
    staleTime: 30000, // Consider data stale after 30 seconds
    retry: false, // Don't retry on failure
  });

  return query;
}
