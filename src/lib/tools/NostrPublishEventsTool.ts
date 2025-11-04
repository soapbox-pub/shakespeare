import { z } from "zod";
import { NPool, NRelay1, type NostrEvent } from '@nostrify/nostrify';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';

import type { Tool } from "./Tool";

interface NostrPublishEventsParams {
  events: Array<{
    kind?: number;
    content?: string;
    tags?: string[][];
    created_at?: number;
  }>;
  relays?: string[];
}

export class NostrPublishEventsTool implements Tool<NostrPublishEventsParams> {
  readonly description = "Publish Nostr events using an ephemeral keypair. All events in a single call are signed by the same ephemeral pubkey. You should include a kind 0 (profile metadata) event in the events array to give the publisher an identity. If no kind 0 is provided, a generic one will be created automatically as a fallback.";

  readonly inputSchema = z.object({
    events: z.array(
      z.object({
        kind: z.number().int().min(0).max(65535).optional().describe('Event kind number (default: 1)'),
        content: z.string().optional().describe('Event content (default: empty string)'),
        tags: z.array(z.array(z.string())).optional().describe('Event tags (default: empty array)'),
        created_at: z.number().int().positive().optional().describe('Unix timestamp in seconds (default: current time)'),
      })
    ).min(1).describe('Array of partial Nostr events to publish. Include a kind 0 event to set profile metadata.'),
    relays: z.array(z.string().url()).optional().describe('Optional array of relay URLs to publish to (default: hardcoded relay list)'),
  });

  async execute(args: NostrPublishEventsParams): Promise<string> {
    const { events: partialEvents, relays } = args;

    // Default relays if none provided
    const defaultRelays = [
      'wss://relay.ditto.pub',
      'wss://relay.nostr.band',
      'wss://relay.primal.net',
    ];

    const targetRelays = relays && relays.length > 0 ? relays : defaultRelays;

    // Generate ephemeral keypair
    const secretKey = generateSecretKey();
    const pubkey = getPublicKey(secretKey);

    // Check if user provided a kind 0 event
    const hasKind0 = partialEvents.some((e) => e.kind === 0);

    // Finalize all user-provided events
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const finalizedEvents: NostrEvent[] = partialEvents.map((partial) => {
      return finalizeEvent({
        kind: partial.kind ?? 1,
        content: partial.content ?? '',
        tags: partial.tags ?? [],
        created_at: partial.created_at ?? currentTimestamp,
      }, secretKey);
    });

    // If no kind 0 was provided, create a generic profile event as fallback
    const allEvents: NostrEvent[] = [];
    if (!hasKind0) {
      const profileEvent = finalizeEvent({
        kind: 0,
        content: JSON.stringify({
          name: 'Ephemeral Publisher',
          about: 'Temporary identity for publishing events',
        }),
        tags: [],
        created_at: currentTimestamp,
      }, secretKey);
      allEvents.push(profileEvent);
    }
    allEvents.push(...finalizedEvents);

    // Create pool for publishing
    const pool = new NPool({
      open(url) {
        return new NRelay1(url);
      },
      eventRouter() {
        return [...targetRelays];
      },
      reqRouter(filters) {
        return new Map(
          [...targetRelays].map((url) => [url, filters]),
        );
      },
    });

    try {
      // Publish all events
      const publishPromises = allEvents.map((event) =>
        pool.event(event, {
          signal: AbortSignal.timeout(10_000),
          relays: targetRelays,
        })
      );

      await Promise.all(publishPromises);

      // Format successful response
      const summary = {
        success: true,
        pubkey,
        events_published: allEvents.length,
        relays: targetRelays,
        events: allEvents.map((e) => ({
          id: e.id,
          kind: e.kind,
          content: e.content.length > 100 ? `${e.content.slice(0, 100)}...` : e.content,
        })),
      };

      return JSON.stringify(summary, null, 2);
    } catch (error) {
      throw new Error(`Error publishing events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await pool.close();
    }
  }
}
