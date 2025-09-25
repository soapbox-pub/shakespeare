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

const GIT_RELAYS = [
  'wss://git.shakespeare.diy/',
  'wss://relay.ngit.dev/',
  'wss://gitnostr.com/',
];

const NostrProvider: React.FC<NostrProviderProps> = (props) => {
  const { children } = props;
  const { config, presetRelays } = useAppContext();

  const queryClient = useQueryClient();

  // Create NPool instance only once
  const pool = useRef<NPool | undefined>(undefined);

  // Use refs so the pool always has the latest data
  const relayUrl = useRef<string>(config.relayUrl);

  // Update refs when config changes
  useEffect(() => {
    relayUrl.current = config.relayUrl;
    queryClient.resetQueries();
  }, [config.relayUrl, queryClient]);

  // Initialize NPool only once
  if (!pool.current) {
    pool.current = new NPool({
      open(url: string) {
        return new NRelay1(url);
      },
      reqRouter(filters) {
        const routes = new Map<string, NostrFilter[]>();
        routes.set(relayUrl.current, filters);

        if (filters.every((f) => f.kinds?.every((k) => GIT_KINDS.includes(k)))) {
          // If all filters are git-related, route to all git relays
          for (const url of GIT_RELAYS) {
            routes.set(url, filters);
          }
        }
        return routes;
      },
      eventRouter(event: NostrEvent) {
        // Publish to the selected relay
        const allRelays = new Set<string>([relayUrl.current]);

        // If it's a git-related event, also publish to the git relays
        if (GIT_KINDS.includes(event.kind)) {
          for (const url of GIT_RELAYS) {
            allRelays.add(url);
          }
        }

        // Also publish to the preset relays, capped to 5
        for (const { url } of (presetRelays ?? [])) {
          allRelays.add(url);

          if (allRelays.size >= 5) {
            break;
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