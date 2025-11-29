import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';

// Kind 30617 for repository announcements (NIP-34)
const REPOSITORY_KIND = 30617;

export interface Repository extends NostrEvent {
  repoId: string;
  name: string;
  description: string;
  webUrls: string[];
  cloneUrls: string[];
  relays: string[];
  maintainers: string[];
  repoTags: string[];
  earliestUniqueCommit?: string;
  isPersonalFork: boolean;
}

export function useUserRepositories(userPubkey?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['nostr', 'user-repositories', userPubkey],
    queryFn: async (): Promise<Repository[]> => {
      if (!userPubkey) {
        return [];
      }

      // Get all repository announcements for this user
      const events = await nostr.query([{
        kinds: [REPOSITORY_KIND],
        authors: [userPubkey],
        limit: 100,
      }], { signal: AbortSignal.timeout(3000) });

      // Process repository events
      const repositories: Repository[] = [];
      const repoMap = new Map<string, NostrEvent>();

      // Group by d-tag (repo-id) to get latest version
      for (const event of events) {
        const dTag = event.tags.find(tag => tag[0] === 'd')?.[1];
        if (!dTag) continue;

        const existing = repoMap.get(dTag);
        if (!existing || event.created_at > existing.created_at) {
          repoMap.set(dTag, event);
        }
      }

      // Convert to Repository objects
      for (const [dTag, event] of repoMap) {
        try {
          const name = event.tags.find(tag => tag[0] === 'name')?.[1] || dTag;
          const description = event.tags.find(tag => tag[0] === 'description')?.[1] || '';
          const webUrls = event.tags.filter(tag => tag[0] === 'web').map(tag => tag[1]).filter(Boolean);
          const cloneUrls = event.tags.filter(tag => tag[0] === 'clone').map(tag => tag[1]).filter(Boolean);
          const relays = event.tags.filter(tag => tag[0] === 'relays').map(tag => tag[1]).filter(Boolean);
          const maintainers = event.tags.filter(tag => tag[0] === 'maintainers').map(tag => tag[1]).filter(Boolean);
          const repoTags = event.tags.filter(tag => tag[0] === 't' && tag[1] !== 'personal-fork').map(tag => tag[1]);
          const earliestUniqueCommit = event.tags.find(tag => tag[0] === 'r' && tag[2] === 'euc')?.[1];
          const isPersonalFork = event.tags.some(tag => tag[0] === 't' && tag[1] === 'personal-fork');

          repositories.push({
            ...event,
            repoId: dTag,
            name,
            description,
            webUrls,
            cloneUrls,
            relays,
            maintainers,
            repoTags,
            earliestUniqueCommit,
            isPersonalFork,
          });
        } catch (error) {
          console.warn('Failed to parse repository:', error);
        }
      }

      return repositories;
    },
    enabled: !!userPubkey,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}
