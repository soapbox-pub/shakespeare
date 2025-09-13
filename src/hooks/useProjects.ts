import { useQuery } from '@tanstack/react-query';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { Project } from '@/lib/ProjectsManager';

export function useProjects() {
  const projectsManager = useProjectsManager();
  const [favorites] = useLocalStorage<string[]>('project-favorites', []);

  return useQuery({
    queryKey: ['projects'],
    queryFn: async (): Promise<Project[]> => {
      await projectsManager.init();
      const projects = await projectsManager.getProjects();
      
      // Sort projects: favorites first, then by lastModified (newest first)
      return projects.sort((a, b) => {
        const aIsFavorite = favorites.includes(a.id);
        const bIsFavorite = favorites.includes(b.id);

        if (aIsFavorite && !bIsFavorite) return -1;
        if (!aIsFavorite && bIsFavorite) return 1;

        return b.lastModified.getTime() - a.lastModified.getTime();
      });
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}