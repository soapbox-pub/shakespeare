import { useAppContext } from '@/hooks/useAppContext';

/**
 * Hook to access configured virtual filesystem paths
 *
 * @returns Object containing VFS path configurations
 */
export function useFSPaths() {
  const { config } = useAppContext();

  return {
    /** Projects directory path (default: /projects) */
    projectsPath: config.fsPathProjects,
    /** Config directory path (default: /config) */
    configPath: config.fsPathConfig,
    /** Temporary files directory path (default: /tmp) */
    tmpPath: config.fsPathTmp,
    /** Plugins directory path (default: /plugins) */
    pluginsPath: config.fsPathPlugins,
  };
}
