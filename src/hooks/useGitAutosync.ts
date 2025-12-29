import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useGit } from './useGit';

export function useGitAutosync(dir: string | undefined) {
  const { git } = useGit();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['git-autosync', dir],
    queryFn: async (): Promise<boolean> => {
      if (!dir) return false;

      try {
        const value = await git.getConfig({
          dir,
          path: 'shakespeare.autosync',
        });
        return value === 'true';
      } catch {
        // Config not set, default to false
        return false;
      }
    },
    enabled: !!dir,
    staleTime: Infinity, // This value rarely changes, keep it cached
  });

  const mutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!dir) throw new Error('No directory specified');

      await git.setConfig({
        dir,
        path: 'shakespeare.autosync',
        value: String(enabled),
      });

      return enabled;
    },
    onSuccess: (enabled) => {
      // Update the cached value immediately
      queryClient.setQueryData(['git-autosync', dir], enabled);

      // If enabling autosync, trigger an immediate sync
      if (enabled) {
        queryClient.invalidateQueries({ queryKey: ['git-sync', dir] });
      }
    },
  });

  return {
    autosync: query.data ?? false,
    isLoading: query.isLoading,
    setAutosync: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}
