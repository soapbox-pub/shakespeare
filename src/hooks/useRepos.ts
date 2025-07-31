import { useQuery } from '@tanstack/react-query';
import { useProjectsManager } from './useProjectsManager';
import { useNostrRepos, type NostrRepo } from './useNostrRepos';
import { useCurrentUser } from './useCurrentUser';
import { nip19 } from 'nostr-tools';
import type { Project } from '@/lib/ProjectsManager';

export type RepoStatus =
  | 'local-only'      // Exists only locally, not published to Nostr
  | 'published'       // Local project that's also published to Nostr
  | 'remote-only'     // Exists on Nostr but not cloned locally
  | 'synced';         // Local and remote are in sync

export interface UnifiedRepo {
  id: string;
  name: string;
  description?: string;
  status: RepoStatus;
  lastModified: Date;

  // Local project data (if exists locally)
  localProject?: Project;

  // Nostr repo data (if exists on Nostr)
  nostrRepo?: NostrRepo;

  // Additional metadata
  tags: string[];
  webUrls: string[];
  cloneUrls: string[];
  maintainers: string[];
  relays: string[];
}

export function useRepos() {
  const projectsManager = useProjectsManager();
  const { user } = useCurrentUser();
  const { data: nostrRepos = [] } = useNostrRepos();

  return useQuery({
    queryKey: ['unified-repos', user?.pubkey],
    queryFn: async () => {
      try {
        await projectsManager.init();
        const localProjects = await projectsManager.getProjects();

        // Create a map to track repos by their identifier
        const repoMap = new Map<string, UnifiedRepo>();

        // First, add all local projects
        for (const project of localProjects) {
          const naddr = await projectsManager.getNostrRepoAddress(project.id);
          let repoId = project.id;
          let status: RepoStatus = 'local-only';

          // If this project has a Nostr address, extract the repo ID
          if (naddr) {
            try {
              const decoded = nip19.decode(naddr);
              if (decoded.type === 'naddr') {
                repoId = decoded.data.identifier;
                status = 'published';
              }
            } catch {
              // If we can't decode the naddr, treat as local-only
            }
          }

          repoMap.set(repoId, {
            id: repoId,
            name: project.name,
            description: undefined,
            status,
            lastModified: project.lastModified,
            localProject: project,
            tags: [],
            webUrls: [],
            cloneUrls: [],
            maintainers: [],
            relays: [],
          });
        }

        // Then, add or update with Nostr repos
        for (const nostrRepo of nostrRepos) {
          const existingRepo = repoMap.get(nostrRepo.id);

          if (existingRepo) {
            // Update existing repo with Nostr data
            existingRepo.nostrRepo = nostrRepo;
            existingRepo.description = nostrRepo.description;
            existingRepo.tags = nostrRepo.tags;
            existingRepo.webUrls = nostrRepo.webUrls;
            existingRepo.cloneUrls = nostrRepo.cloneUrls;
            existingRepo.maintainers = nostrRepo.maintainers;
            existingRepo.relays = nostrRepo.relays;

            // Update status based on local presence
            if (existingRepo.localProject) {
              existingRepo.status = 'synced';
            }
          } else {
            // Add new remote-only repo
            repoMap.set(nostrRepo.id, {
              id: nostrRepo.id,
              name: nostrRepo.name,
              description: nostrRepo.description,
              status: 'remote-only',
              lastModified: new Date(nostrRepo.event.created_at * 1000),
              nostrRepo,
              tags: nostrRepo.tags,
              webUrls: nostrRepo.webUrls,
              cloneUrls: nostrRepo.cloneUrls,
              maintainers: nostrRepo.maintainers,
              relays: nostrRepo.relays,
            });
          }
        }

        // Convert map to array and sort by last modified
        const repos = Array.from(repoMap.values()).sort((a, b) =>
          b.lastModified.getTime() - a.lastModified.getTime()
        );

        return repos;
      } catch (error) {
        console.error('Failed to load unified repos:', error);
        return [];
      }
    },
    enabled: !!user?.pubkey,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000, // 1 minute
  });
}