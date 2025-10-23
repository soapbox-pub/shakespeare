import { useMemo } from 'react';
import { ProjectsManager } from '@/lib/ProjectsManager';
import { useFS } from '@/hooks/useFS';
import { useFSPaths } from '@/hooks/useFSPaths';
import { useGit } from './useGit';

/**
 * Hook that provides a ProjectsManager instance.
 * The ProjectsManager is memoized based on the fs instance and configured paths.
 */
export function useProjectsManager() {
  const { fs } = useFS();
  const { git } = useGit();
  const { projectsPath } = useFSPaths();

  const projectsManager = useMemo(() => {
    return new ProjectsManager({ fs, git, projectsPath });
  }, [fs, git, projectsPath]);

  return projectsManager;
}