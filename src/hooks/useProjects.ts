import { useQuery } from '@tanstack/react-query';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { ChatItem } from '@/lib/ProjectsManager';

export function useProjects() {
  const projectsManager = useProjectsManager();
  const [favorites] = useLocalStorage<string[]>('project-favorites', []);

  return useQuery({
    queryKey: ['projects'],
    queryFn: async (): Promise<ChatItem[]> => {
      await projectsManager.init();
      const items = await projectsManager.getAllChatItems();

      // Sort items: favorites first, then by lastModified (newest first)
      return items.sort((a, b) => {
        const aIsFavorite = favorites.includes(a.id);
        const bIsFavorite = favorites.includes(b.id);

        if (aIsFavorite && !bIsFavorite) return -1;
        if (!aIsFavorite && bIsFavorite) return 1;

        return b.lastModified.getTime() - a.lastModified.getTime();
      });
    },
  });
}