import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

/**
 * Hook to get the user's contact list (kind 3 follow list)
 * Returns an array of pubkeys that the user follows
 */
export function useContacts(userPubkey?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['nostr', 'contacts', userPubkey],
    queryFn: async (): Promise<string[]> => {
      if (!userPubkey) {
        return [];
      }

      // Get the user's contact list (kind 3)
      const events = await nostr.query([{
        kinds: [3],
        authors: [userPubkey],
        limit: 1,
      }], { signal: AbortSignal.timeout(3000) });

      if (events.length === 0) {
        return [];
      }

      // Get the most recent contact list event
      const contactList = events.sort((a, b) => b.created_at - a.created_at)[0];

      // Extract pubkeys from 'p' tags
      const followedPubkeys = contactList.tags
        .filter(tag => tag[0] === 'p' && tag[1])
        .map(tag => tag[1]);

      return followedPubkeys;
    },
    enabled: !!userPubkey,
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // 5 minutes
  });
}
