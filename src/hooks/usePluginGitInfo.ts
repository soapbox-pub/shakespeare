import { useQuery } from '@tanstack/react-query';
import { useFS } from './useFS';
import { useFSPaths } from './useFSPaths';
import { getPluginGitInfo } from '@/lib/plugins';

/**
 * Hook to get git info for a specific plugin
 */
export function usePluginGitInfo(pluginName: string) {
  const { fs } = useFS();
  const { pluginsPath } = useFSPaths();

  return useQuery({
    queryKey: ['plugin-git-info', pluginsPath, pluginName],
    queryFn: async () => {
      return await getPluginGitInfo(fs, pluginsPath, pluginName);
    },
    enabled: !!pluginName,
  });
}
