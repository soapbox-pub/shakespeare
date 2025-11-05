import React, { useEffect, useRef } from 'react';
import { NostrEvent, NostrFilter, NPool, NRelay1 } from '@nostrify/nostrify';
import { NostrContext } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';

interface NostrProviderProps {
  children: React.ReactNode;
}

const GIT_KINDS = [
  30617, // NIP-34 Repository Announcement
  30618, // NIP-34 Commit Announcement
  1617, // NIP-34 Patch
  1621, // NIP-34 Issue
];

const NostrProvider: React.FC<NostrProviderProps> = (props) => {
  const { children } = props;
  const { config } = useAppContext();

  const gitRelays = config.ngitServers.map(server => `wss://${server}/`);
  const queryClient = useQueryClient();

  // Create NPool instance only once
  const pool = useRef<NPool | undefined>(undefined);

  // Use refs so the pool always has the latest data
  const relayMetadata = useRef(config.relayMetadata);

  // Update refs when config changes
  useEffect(() => {
    relayMetadata.current = config.relayMetadata;
    queryClient.invalidateQueries({ queryKey: ['nostr'] });
  }, [config.relayMetadata, queryClient]);

  // Initialize NPool only once
  if (!pool.current) {
    pool.current = new NPool({
      open(url: string) {
        return new NRelay1(url);
      },
      reqRouter(filters) {
        const routes = new Map<string, NostrFilter[]>();

        // Route to all read relays
        const readRelays = relayMetadata.current.relays
          .filter(r => r.read)
          .map(r => r.url);

        for (const url of readRelays) {
          routes.set(url, filters);
        }

        // If all filters are git-related, also route to all git relays
        if (filters.every((f) => f.kinds?.every((k) => GIT_KINDS.includes(k)))) {
          for (const url of gitRelays) {
            routes.set(url, filters);
          }
        }

        return routes;
      },
      eventRouter(event: NostrEvent) {
        // Get write relays from metadata
        const writeRelays = relayMetadata.current.relays
          .filter(r => r.write)
          .map(r => r.url);

        const allRelays = new Set<string>(writeRelays);

        // If it's a git-related event, also publish to the git relays
        if (GIT_KINDS.includes(event.kind)) {
          for (const url of gitRelays) {
            allRelays.add(url);
          }
        }

        return [...allRelays];
      },
    });
  }

  return (
    <NostrContext.Provider value={{ nostr: pool.current }}>
      {children}
    </NostrContext.Provider>
  );
};

export default NostrProvider;