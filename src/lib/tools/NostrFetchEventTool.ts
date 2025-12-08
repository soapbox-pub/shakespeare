import { z } from "zod";
import { NPool, NRelay1, type NostrEvent } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

import type { Tool, ToolResult } from "./Tool";

interface NostrFetchEventParams {
  identifier: string;
}

export class NostrFetchEventTool implements Tool<NostrFetchEventParams> {
  readonly description = "Fetch a Nostr event using a nip19 identifier";

  readonly inputSchema = z.object({
    identifier: z
      .string()
      .superRefine((val, ctx) => {
        let decoded: nip19.DecodedResult;
        try {
          decoded = nip19.decode(val);
        } catch {
          ctx.addIssue({
            code: 'custom',
            message:
              `Failed to decode identifier. Invalid NIP-19 identifier: ${val}`,
          });
          return;
        }

        // Reject nsec for security reasons
        if (decoded.type === 'nsec') {
          ctx.addIssue({
            code: 'custom',
            message:
              'nsec identifiers are not supported for security reasons',
          });
          return;
        }

        // Accept npub, nprofile, naddr, note, nevent
        if (!['npub', 'nprofile', 'naddr', 'note', 'nevent'].includes(decoded.type)) {
          ctx.addIssue({
            code: 'custom',
            message:
              `Unsupported identifier type: ${decoded.type}. Supported types: npub, nprofile, naddr, note, nevent`,
          });
          return;
        }
      })
      .describe(
        'NIP-19 identifier (npub, nprofile, naddr, note, or nevent), e.g. npub1... or naddr1...',
      ),
  });

  async execute(args: NostrFetchEventParams): Promise<ToolResult> {
    const { identifier } = args;

    const decoded = nip19.decode(identifier);

    const defaultRelays = [
      'wss://relay.ditto.pub',
      'wss://relay.nostr.band',
      'wss://relay.primal.net',
    ];

    const pool = new NPool({
      open(url) {
        return new NRelay1(url);
      },
      eventRouter() {
        return [...defaultRelays];
      },
      reqRouter(filters) {
        return new Map(
          [...defaultRelays].map((url) => [url, filters]),
        );
      },
    });

    try {
      let event: NostrEvent | undefined;

      switch (decoded.type) {
        case 'npub': {
          // For npub, fetch the user's kind 0 (profile) event
          [event] = await pool.query(
            [{
              kinds: [0],
              authors: [decoded.data],
              limit: 1,
            }],
            { signal: AbortSignal.timeout(8_000) },
          );
          break;
        }

        case 'nprofile': {
          // For nprofile, fetch the user's kind 0 (profile) event
          let { relays } = decoded.data;

          if (!relays || !relays.length) {
            relays = defaultRelays;
          }

          [event] = await pool.group(relays).query(
            [{
              kinds: [0],
              authors: [decoded.data.pubkey],
              limit: 1,
            }],
            { signal: AbortSignal.timeout(8_000) },
          );
          break;
        }

        case 'note': {
          // For note, fetch the specific event by ID
          [event] = await pool.query(
            [{ ids: [decoded.data] }],
            { signal: AbortSignal.timeout(8_000) },
          );
          break;
        }

        case 'nevent': {
          // For nevent, fetch the specific event by ID
          let { relays } = decoded.data;

          if (!relays || !relays.length) {
            relays = defaultRelays;
          }

          [event] = await pool.group(relays).query(
            [{
              ids: [decoded.data.id],
            }],
            { signal: AbortSignal.timeout(8_000) },
          );
          break;
        }

        case 'naddr': {
          // For naddr, fetch by kind, pubkey, and d tag
          let { relays } = decoded.data;

          if (!relays || !relays.length) {
            relays = defaultRelays;
          }

          [event] = await pool.group(relays).query(
            [{
              kinds: [decoded.data.kind],
              authors: [decoded.data.pubkey],
              '#d': [decoded.data.identifier],
            }],
            { signal: AbortSignal.timeout(8_000) },
          );
          break;
        }

        default:
          throw new Error(`Unsupported identifier type: ${decoded.type}`);
      }

      if (!event) {
        throw new Error('No event found for the provided identifier. Make sure it exists and is accessible.');
      }

      // Special handling for specific kinds
      if (event.kind === 30817) {
        // Kind 30817 is a NIP document, return just the content
        return { content: event.content };
      }

      // For other kinds, return the full event JSON
      return { content: JSON.stringify(event, null, 2) };

    } catch (error) {
      throw new Error(`Error fetching event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await pool.close();
    }
  }
}