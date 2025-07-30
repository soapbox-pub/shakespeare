import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import type { NostrEvent } from '@nostrify/nostrify';

export interface NostrRepo {
  event: NostrEvent;
  id: string; // d tag value
  name: string;
  description?: string;
  webUrls: string[];
  cloneUrls: string[];
  relays: string[];
  maintainers: string[];
  tags: string[];
  earliestCommit?: string;
}

function parseRepoEvent(event: NostrEvent): NostrRepo | null {
  // Validate that this is a repository announcement event
  if (event.kind !== 30617) return null;

  const dTag = event.tags.find(([name]) => name === 'd')?.[1];
  if (!dTag) return null;

  const name = event.tags.find(([name]) => name === 'name')?.[1] || dTag;
  const description = event.tags.find(([name]) => name === 'description')?.[1];
  
  const webUrls = event.tags
    .filter(([name]) => name === 'web')
    .map(([, url]) => url)
    .filter(Boolean);
    
  const cloneUrls = event.tags
    .filter(([name]) => name === 'clone')
    .map(([, url]) => url)
    .filter(Boolean);
    
  const relays = event.tags
    .filter(([name]) => name === 'relays')
    .map(([, relay]) => relay)
    .filter(Boolean);
    
  const maintainers = event.tags
    .filter(([name]) => name === 'maintainers')
    .map(([, pubkey]) => pubkey)
    .filter(Boolean);
    
  const tags = event.tags
    .filter(([name]) => name === 't')
    .map(([, tag]) => tag)
    .filter(Boolean);
    
  const earliestCommit = event.tags
    .find(([name, , marker]) => name === 'r' && marker === 'euc')?.[1];

  return {
    event,
    id: dTag,
    name,
    description,
    webUrls,
    cloneUrls,
    relays,
    maintainers,
    tags,
    earliestCommit,
  };
}

export function useNostrRepos() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['nostr-repos', user?.pubkey],
    queryFn: async (c) => {
      if (!user?.pubkey) return [];
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      
      // Query for repository announcements by the current user
      const events = await nostr.query([
        {
          kinds: [30617], // Repository announcements
          authors: [user.pubkey],
          limit: 50,
        }
      ], { signal });

      // Parse and validate events
      const repos = events
        .map(parseRepoEvent)
        .filter((repo): repo is NostrRepo => repo !== null)
        .sort((a, b) => b.event.created_at - a.event.created_at);

      return repos;
    },
    enabled: !!user?.pubkey,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}