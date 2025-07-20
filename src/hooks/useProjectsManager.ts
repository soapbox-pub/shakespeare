import { useMemo } from 'react';
import { ProjectsManager } from '@/lib/fs';
import { useFS } from '@/hooks/useFS';

/**
 * Hook that provides a ProjectsManager instance.
 * The ProjectsManager is memoized based on the fs instance.
 */
export function useProjectsManager() {
  const { fs } = useFS();
  
  const projectsManager = useMemo(() => new ProjectsManager(fs), [fs]);
  
  return projectsManager;
}