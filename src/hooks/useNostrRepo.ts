import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface UseNostrRepoOptions {
  repoIdentifier: string;
  enabled?: boolean;
}

/**
 * Hook to fetch a Nostr repository announcement event (kind 30617) by identifier.
 * The query is cached for 30 seconds and can be prefetched for better UX.
 */
export function useNostrRepo({ repoIdentifier, enabled = true }: UseNostrRepoOptions) {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['nostr-repo', user?.pubkey, repoIdentifier],
    queryFn: async () => {
      if (!user) return null;

      const events = await nostr.query(
        [{ kinds: [30617], authors: [user.pubkey], '#d': [repoIdentifier], limit: 1 }],
        { signal: AbortSignal.timeout(5000) }
      );

      return events.length > 0 ? events[0] : null;
    },
    enabled: enabled && !!user && !!repoIdentifier,
    staleTime: 30000, // Cache for 30 seconds
  });
}
