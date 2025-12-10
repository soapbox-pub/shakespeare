import { type NostrEvent, NRelay1 } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

// Soapbox npub for calendar events
// npub10qdp2fc9ta6vraczxrcs8prqnv69fru2k6s2dj48gqjcylulmtjsg9arpj
const SOAPBOX_PUBKEY = '7806855384bdda1c7bc0431c40e18699345a47cadb505b2a9d012c27e7e7f5ca';

// ShakespeareGitCommits bot npub
// npub1msc06u2v3y3z2awdxlc7k2tnjlc78xg8awvha5rsaphd8py7ussqd0phxu
const COMMITS_BOT_PUBKEY = 'dc30f45e534244455d5ba6fc3b2acfc9ff2a1cd8aa31fb50c70bbfab5294f016';

// Shakespeare group ID for kind 9 chat messages
const SHAKESPEARE_GROUP_ID = '41299083392805314';

// Shakespeare chat relay (NIP-29 group relay)
const SHAKESPEARE_CHAT_RELAY = 'wss://chat.shakespeare.diy/';

// Featured testimonials - curated note IDs
const FEATURED_TESTIMONIAL_IDS: string[] = [
  // Add hand-selected note IDs here as they are curated
];

/**
 * Hook to fetch #ShakespeareDIY feed (kind 1 notes with the hashtag)
 */
export function useShakespeareFeed(limit = 20) {
  const { nostr } = useNostr();

  return useQuery<NostrEvent[]>({
    queryKey: ['shakespeare-feed', limit],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query(
        [{ kinds: [1], '#t': ['shakespearediy', 'ShakespeareDIY'], limit }],
        { signal }
      );
      return events;
    },
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to fetch calendar events that Soapbox is attending (NIP-52)
 * Fetches both date-based (31922) and time-based (31923) calendar events
 */
export function useCommunityEvents(limit = 10) {
  const { nostr } = useNostr();

  return useQuery<NostrEvent[]>({
    queryKey: ['community-events', limit],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Query for calendar events where Soapbox is tagged as a participant
      const events = await nostr.query(
        [{
          kinds: [31922, 31923],
          '#p': [SOAPBOX_PUBKEY],
          limit
        }],
        { signal }
      );

      // Filter for future events only
      const now = Math.floor(Date.now() / 1000);
      return events.filter(event => {
        const startTag = event.tags.find(([name]) => name === 'start')?.[1];
        if (!startTag) return false;

        // For time-based events, start is a unix timestamp
        if (event.kind === 31923) {
          const startTime = parseInt(startTag, 10);
          return !isNaN(startTime) && startTime > now;
        }

        // For date-based events, start is YYYY-MM-DD
        if (event.kind === 31922) {
          const today = new Date().toISOString().split('T')[0];
          return startTag >= today;
        }

        return true;
      }).sort((a, b) => {
        // Sort by start date/time
        const aStart = a.tags.find(([name]) => name === 'start')?.[1] || '';
        const bStart = b.tags.find(([name]) => name === 'start')?.[1] || '';
        return aStart.localeCompare(bStart);
      });
    },
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Hook to fetch latest commits from ShakespeareGitCommits bot (NIP-29 kind 9 chat messages)
 * Connects directly to the Shakespeare chat relay since kind 9 events are relay-specific
 */
export function useLatestCommits(limit = 5) {
  return useQuery<NostrEvent[]>({
    queryKey: ['latest-commits', limit],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Connect directly to the Shakespeare chat relay for kind 9 events
      const relay = new NRelay1(SHAKESPEARE_CHAT_RELAY);

      try {
        // Query for kind 9 chat messages from the commits bot in the Shakespeare group
        const events = await relay.query(
          [{
            kinds: [9],
            authors: [COMMITS_BOT_PUBKEY],
            '#h': [SHAKESPEARE_GROUP_ID],
            limit
          }],
          { signal }
        );

        return events;
      } finally {
        relay.close();
      }
    },
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to fetch featured testimonials (hand-picked kind 1 notes)
 */
export function useFeaturedTestimonials() {
  const { nostr } = useNostr();

  return useQuery<NostrEvent[]>({
    queryKey: ['featured-testimonials'],
    queryFn: async (c) => {
      if (FEATURED_TESTIMONIAL_IDS.length === 0) {
        return [];
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query(
        [{ kinds: [1], ids: FEATURED_TESTIMONIAL_IDS }],
        { signal }
      );
      return events;
    },
    staleTime: 300000, // 5 minutes
    enabled: FEATURED_TESTIMONIAL_IDS.length > 0,
  });
}

/**
 * Helper to extract calendar event metadata from a NostrEvent
 */
export function extractCalendarEventData(event: NostrEvent) {
  const tags = event.tags;

  return {
    id: tags.find(([name]) => name === 'd')?.[1] || event.id,
    title: tags.find(([name]) => name === 'title')?.[1] || tags.find(([name]) => name === 'name')?.[1] || 'Untitled Event',
    summary: tags.find(([name]) => name === 'summary')?.[1] || '',
    description: event.content || '',
    image: tags.find(([name]) => name === 'image')?.[1],
    location: tags.find(([name]) => name === 'location')?.[1],
    start: tags.find(([name]) => name === 'start')?.[1] || '',
    end: tags.find(([name]) => name === 'end')?.[1],
    startTzid: tags.find(([name]) => name === 'start_tzid')?.[1],
    endTzid: tags.find(([name]) => name === 'end_tzid')?.[1],
    geohash: tags.find(([name]) => name === 'g')?.[1],
    hashtags: tags.filter(([name]) => name === 't').map(([, value]) => value),
    references: tags.filter(([name]) => name === 'r').map(([, value]) => value),
    kind: event.kind,
    pubkey: event.pubkey,
    created_at: event.created_at,
  };
}

/**
 * Format a calendar event date for display
 */
export function formatEventDate(start: string, kind: number, startTzid?: string): string {
  if (kind === 31923) {
    // Time-based event - start is unix timestamp
    const timestamp = parseInt(start, 10);
    if (isNaN(timestamp)) return 'Invalid date';

    const date = new Date(timestamp * 1000);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    };
    if (startTzid) {
      options.timeZone = startTzid;
    }
    return date.toLocaleString(undefined, options);
  }

  if (kind === 31922) {
    // Date-based event - start is YYYY-MM-DD
    const date = new Date(start + 'T00:00:00');
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return start;
}
