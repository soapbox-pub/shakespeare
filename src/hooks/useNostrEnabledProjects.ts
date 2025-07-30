import { useQuery } from '@tanstack/react-query';
import { useProjectsManager } from './useProjectsManager';
import { nip19 } from 'nostr-tools';

export function useNostrEnabledProjects() {
  const projectsManager = useProjectsManager();

  return useQuery({
    queryKey: ['nostr-enabled-projects'],
    queryFn: async () => {
      try {
        await projectsManager.init();
        const projects = await projectsManager.getProjects();
        
        const nostrEnabledProjects: string[] = [];
        
        for (const project of projects) {
          try {
            const naddr = await projectsManager.getNostrRepoAddress(project.id);
            if (naddr) {
              // Extract the d tag (identifier) from the naddr
              const decoded = nip19.decode(naddr);
              if (decoded.type === 'naddr') {
                nostrEnabledProjects.push(decoded.data.identifier);
              }
            }
          } catch {
            // Skip projects that can't be checked
          }
        }
        
        return nostrEnabledProjects;
      } catch {
        return [];
      }
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000, // 1 minute
  });
}