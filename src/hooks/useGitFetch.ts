import { useQuery } from '@tanstack/react-query';
import { useGit } from './useGit';

export function useGitFetch(dir: string | undefined) {
  const { git } = useGit();

  const query = useQuery({
    queryKey: ['git-fetch', dir],
    queryFn: async (): Promise<void> => {
      if (!dir) {
        return;
      }

      try {
        
        try {
          await git.fetch({
            dir,
          });
        } catch (error) {
          // Fetch failed, but don't throw - just log and return null
          console.warn('Git fetch failed:', error);
          return;
        }
      } catch (error) {
        console.error('Error during git fetch:', error);
        return;
      }
    },
    enabled: !!dir,
    refetchInterval: 60000, // Fetch every 60 seconds
    staleTime: 30000, // Consider data stale after 30 seconds
    retry: false, // Don't retry on failure
  });

  return query;
}
