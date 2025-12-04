import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

export interface DiscoveredPlugin {
  id: string;
  event: NostrEvent;
  name: string;
  description: string;
  cloneUrl?: string;
  webUrl?: string;
  author: string;
}

/**
 * Hook to discover Shakespeare plugins on Nostr
 * Queries NIP-34 git repository announcements with t-tag "shakespeare-plugin"
 */
export function useDiscoverPlugins() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['discover-plugins'],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Query NIP-34 repository announcements (kind 30617) with shakespeare-plugin tag
      const events = await nostr.query(
        [
          {
            kinds: [30617],
            '#t': ['shakespeare-plugin'],
            limit: 100,
          },
        ],
        { signal }
      );

      // Transform events into DiscoveredPlugin objects
      const plugins: DiscoveredPlugin[] = events
        .map((event): DiscoveredPlugin | null => {
          const dTag = event.tags.find(([name]) => name === 'd')?.[1];
          const nameTag = event.tags.find(([name]) => name === 'name')?.[1];
          const descriptionTag = event.tags.find(([name]) => name === 'description')?.[1];
          const cloneTag = event.tags.find(([name]) => name === 'clone')?.[1];
          const webTag = event.tags.find(([name]) => name === 'web')?.[1];

          // Skip events without required fields
          if (!dTag || !nameTag) {
            return null;
          }

          return {
            id: dTag,
            event,
            name: nameTag,
            description: descriptionTag || '',
            cloneUrl: cloneTag,
            webUrl: webTag,
            author: event.pubkey,
          };
        })
        .filter((plugin): plugin is DiscoveredPlugin => plugin !== null);

      return plugins;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
