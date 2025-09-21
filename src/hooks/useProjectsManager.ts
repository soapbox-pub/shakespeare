import { useMemo } from 'react';
import { ProjectsManager } from '@/lib/ProjectsManager';
import { useFS } from '@/hooks/useFS';
import { useGit } from './useGit';

/**
 * Hook that provides a ProjectsManager instance.
 * The ProjectsManager is memoized based on the fs instance.
 */
export function useProjectsManager() {
  const { fs } = useFS();
  const { git } = useGit();

  const projectsManager = useMemo(() => {
    return new ProjectsManager({ fs, git });
  }, [fs, git]);

  return projectsManager;
}