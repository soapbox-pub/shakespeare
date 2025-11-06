import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFS } from './useFS';
import { useFSPaths } from './useFSPaths';
import { getPlugins, getAllSkills, deletePlugin as deletePluginFn } from '@/lib/plugins';
import { useGit } from './useGit';
import { join } from 'path-browserify';

/**
 * Hook to manage plugins and skills
 */
export function usePlugins() {
  const { fs } = useFS();
  const { pluginsPath } = useFSPaths();
  const queryClient = useQueryClient();
  const { git } = useGit();

  // Query to get all plugins
  const pluginsQuery = useQuery({
    queryKey: ['plugins', pluginsPath],
    queryFn: async () => {
      return await getPlugins(fs, pluginsPath);
    },
  });

  // Query to get all skills
  const skillsQuery = useQuery({
    queryKey: ['skills', pluginsPath],
    queryFn: async () => {
      return await getAllSkills(fs, pluginsPath);
    },
  });

  // Mutation to clone a plugin from a git URL
  const clonePlugin = useMutation({
    mutationFn: async ({ gitUrl, pluginName }: { gitUrl: string; pluginName?: string }) => {
      // Extract plugin name from git URL if not provided
      let name = pluginName;
      if (!name) {
        // Extract from URL: https://github.com/user/repo.git -> repo
        const match = gitUrl.match(/\/([^/]+?)(\.git)?$/);
        if (!match) {
          throw new Error('Invalid git URL');
        }
        name = match[1];
      }

      const pluginDir = join(pluginsPath, name);

      // Ensure plugins directory exists
      try {
        await fs.stat(pluginsPath);
      } catch {
        await fs.mkdir(pluginsPath, { recursive: true });
      }

      // Check if plugin already exists
      try {
        await fs.stat(pluginDir);
        throw new Error(`Plugin "${name}" already exists`);
      } catch (error) {
        // Plugin doesn't exist, continue
        if (error instanceof Error && error.message.includes('already exists')) {
          throw error;
        }
      }

      // Clone the repository
      await git.clone({
        dir: pluginDir,
        url: gitUrl,
        depth: 1,
        singleBranch: true,
      });

      return name;
    },
    onSuccess: () => {
      // Invalidate queries to refresh the lists
      queryClient.invalidateQueries({ queryKey: ['plugins', pluginsPath] });
      queryClient.invalidateQueries({ queryKey: ['skills', pluginsPath] });
    },
  });

  // Mutation to sync (pull) a plugin
  const syncPlugin = useMutation({
    mutationFn: async (pluginName: string) => {
      const pluginDir = join(pluginsPath, pluginName);

      // Pull latest changes
      await git.pull({
        dir: pluginDir,
        singleBranch: true,
        fastForward: true,
      });

      return pluginName;
    },
    onSuccess: () => {
      // Invalidate queries to refresh the lists
      queryClient.invalidateQueries({ queryKey: ['plugins', pluginsPath] });
      queryClient.invalidateQueries({ queryKey: ['skills', pluginsPath] });
    },
  });

  // Mutation to delete a plugin
  const deletePlugin = useMutation({
    mutationFn: async (pluginName: string) => {
      await deletePluginFn(fs, pluginsPath, pluginName);
      return pluginName;
    },
    onSuccess: () => {
      // Invalidate queries to refresh the lists
      queryClient.invalidateQueries({ queryKey: ['plugins', pluginsPath] });
      queryClient.invalidateQueries({ queryKey: ['skills', pluginsPath] });
    },
  });

  return {
    plugins: pluginsQuery.data || [],
    isLoadingPlugins: pluginsQuery.isLoading,
    skills: skillsQuery.data || [],
    isLoadingSkills: skillsQuery.isLoading,
    clonePlugin,
    syncPlugin,
    deletePlugin,
  };
}
