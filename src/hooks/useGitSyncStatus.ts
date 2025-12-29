import { useGitSyncState } from './useGitSyncState';
import { useFSPaths } from './useFSPaths';

/**
 * Hook to get the current git sync status for a project
 */
export function useGitSyncStatus(projectId: string | undefined) {
  const { getState } = useGitSyncState();
  const { projectsPath } = useFSPaths();

  if (!projectId) {
    return {
      isActive: false,
      operation: null,
    };
  }

  const dir = `${projectsPath}/${projectId}`;
  const state = getState(dir);

  return {
    isActive: state?.isActive || false,
    operation: state?.operation || null,
  };
}
