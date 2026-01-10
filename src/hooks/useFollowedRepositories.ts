import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';
import type { Repository } from './useUserRepositories';

// Kind 30617 for repository announcements (NIP-34)
const REPOSITORY_KIND = 30617;

/**
 * Hook to get repositories from a list of followed users
 */
export function useFollowedRepositories(followedPubkeys: string[] = []) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['nostr', 'followed-repositories', followedPubkeys],
    queryFn: async (): Promise<Repository[]> => {
      if (followedPubkeys.length === 0) {
        return [];
      }

      // Get all repository announcements from followed users
      const events = await nostr.query([{
        kinds: [REPOSITORY_KIND],
        authors: followedPubkeys,
        limit: 500, // Increased limit to get more repos from follows
      }], { signal: AbortSignal.timeout(5000) });

      // Process repository events
      const repositories: Repository[] = [];
      const repoMap = new Map<string, NostrEvent>();

      // Group by author+d-tag to get latest version of each repo
      for (const event of events) {
        const dTag = event.tags.find(tag => tag[0] === 'd')?.[1];
        if (!dTag) continue;

        const key = `${event.pubkey}:${dTag}`;
        const existing = repoMap.get(key);
        if (!existing || event.created_at > existing.created_at) {
          repoMap.set(key, event);
        }
      }

      // Convert to Repository objects
      for (const [, event] of repoMap) {
        try {
          const dTag = event.tags.find(tag => tag[0] === 'd')?.[1];
          if (!dTag) continue;

          const name = event.tags.find(tag => tag[0] === 'name')?.[1] || dTag;
          const description = event.tags.find(tag => tag[0] === 'description')?.[1] || '';
          
          // Extract multi-value tags correctly (all values are in a single tag per NIP-34)
          const webTag = event.tags.find(tag => tag[0] === 'web');
          const webUrls = webTag ? webTag.slice(1).filter(Boolean) : [];
          
          const cloneTag = event.tags.find(tag => tag[0] === 'clone');
          const cloneUrls = cloneTag ? cloneTag.slice(1).filter(Boolean) : [];
          
          const relaysTag = event.tags.find(tag => tag[0] === 'relays');
          const relays = relaysTag ? relaysTag.slice(1).filter(Boolean) : [];
          
          const maintainersTag = event.tags.find(tag => tag[0] === 'maintainers');
          const maintainers = maintainersTag ? maintainersTag.slice(1).filter(Boolean) : [];
          const repoTags = event.tags.filter(tag => tag[0] === 't' && tag[1] !== 'personal-fork').map(tag => tag[1]);
          const earliestUniqueCommit = event.tags.find(tag => tag[0] === 'r' && tag[2] === 'euc')?.[1];
          const isPersonalFork = event.tags.some(tag => tag[0] === 't' && tag[1] === 'personal-fork');

          // Filter out invalid repositories without clone URLs
          if (cloneUrls.length === 0) {
            console.warn('Skipping repository without clone URLs:', dTag);
            continue;
          }

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

      // Sort by created_at (newest first)
      return repositories.sort((a, b) => b.created_at - a.created_at);
    },
    enabled: followedPubkeys.length > 0,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}
