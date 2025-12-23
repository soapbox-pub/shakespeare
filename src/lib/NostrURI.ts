import { NIP05 } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

/**
 * Represents a parsed Nostr URI with its components
 */
export interface NostrURIParts {
  /** The public key (hex format) */
  pubkey: string;
  /** The identifier (d-tag value) */
  identifier: string;
  /** Optional relay URL */
  relay?: string;
}

/**
 * NostrURI class for parsing and constructing Nostr URIs
 *
 * Supports formats:
 * - nostr://npub/identifier
 * - nostr://npub/relay/identifier
 * - nostr://nip05@domain/identifier
 * - nostr://nip05@domain/relay/identifier
 *
 * @example
 * ```ts
 * // Construct from parts
 * const uri = new NostrURI({
 *   pubkey: 'abc123...',
 *   identifier: 'my-repo',
 *   relay: 'relay.example.com'
 * });
 *
 * // Parse from string
 * const uri = await NostrURI.parse('nostr://npub1.../my-repo');
 * ```
 */
export class NostrURI {
  public readonly pubkey: string;
  public readonly identifier: string;
  public readonly relay?: string;

  /**
   * Construct a NostrURI from its component parts
   */
  constructor(parts: NostrURIParts) {
    this.pubkey = parts.pubkey;
    this.identifier = parts.identifier;
    this.relay = parts.relay;
  }

  /**
   * Parse a Nostr URI string into a NostrURI instance
   *
   * @param uri - The Nostr URI string to parse
   * @returns A NostrURI instance
   * @throws Error if the URI format is invalid
   *
   * @example
   * ```ts
   * const uri = await NostrURI.parse('nostr://npub1abc.../my-repo');
   * console.log(uri.pubkey); // hex pubkey
   * console.log(uri.identifier); // 'my-repo'
   * ```
   */
  static async parse(uri: string): Promise<NostrURI> {
    if (!uri.startsWith('nostr://')) {
      throw new Error('Invalid Nostr URI: must start with "nostr://"');
    }

    const path = uri.slice(8); // Remove 'nostr://' prefix
    const parts = path.split('/');

    if (parts.length < 2) {
      throw new Error('Invalid Nostr URI: must have at least pubkey/identifier');
    }

    const identifierPart = parts[0];
    let pubkey: string;

    // Try to decode as npub first
    try {
      const decoded = nip19.decode(identifierPart);
      if (decoded.type === 'npub') {
        pubkey = decoded.data;
      } else {
        throw new Error('Invalid Nostr URI: identifier must be npub or NIP-05 address');
      }
    } catch {
      // If decoding fails, check if it's a NIP-05 identifier
      if (identifierPart.includes('@')) {
        try {
          const pointer = await NIP05.lookup(identifierPart, {
            signal: AbortSignal.timeout(3000),
          });
          pubkey = pointer.pubkey;
        } catch (error) {
          throw new Error(`Invalid Nostr URI: failed to resolve NIP-05 identifier: ${error}`);
        }
      } else {
        throw new Error('Invalid Nostr URI: identifier must be npub or NIP-05 address');
      }
    }

    // Parse the remaining parts based on length
    if (parts.length === 2) {
      // Format: nostr://npub/identifier
      return new NostrURI({
        pubkey,
        identifier: parts[1],
      });
    } else if (parts.length === 3) {
      // Format: nostr://npub/relay/identifier
      const relay = parts[1].startsWith('wss://') ? parts[1] : `wss://${parts[1]}/`;
      return new NostrURI({
        pubkey,
        relay,
        identifier: parts[2],
      });
    } else {
      // Handle the case where wss:// is included in the URI
      // When split by /, wss://relay.example.com becomes ['wss:', '', 'relay.example.com']
      // So we need to reconstruct the relay URL

      // Find where 'wss:' appears in the parts array
      const wssIndex = parts.findIndex(part => part === 'wss:');

      if (wssIndex > 0 && parts.length > wssIndex + 2) {
        // Reconstruct the relay URL: wss://hostname/
        const hostname = parts[wssIndex + 2]; // Skip the empty string after wss:
        const relay = `wss://${hostname}/`;
        const identifier = parts[wssIndex + 3];

        return new NostrURI({
          pubkey,
          relay,
          identifier,
        });
      }

      throw new Error('Invalid Nostr URI: too many path segments');
    }
  }

  /**
   * Convert the NostrURI to a string representation
   *
   * @returns The Nostr URI as a string
   *
   * @example
   * ```ts
   * const uri = new NostrURI({ pubkey: 'abc...', identifier: 'my-repo' });
   * console.log(uri.toString()); // 'nostr://npub1.../my-repo'
   * ```
   */
  toString(): string {
    const npub = nip19.npubEncode(this.pubkey);

    if (this.relay) {
      try {
        const url = new URL(this.relay);
        return `nostr://${npub}/${url.hostname}/${this.identifier}`;
      } catch {
        // fallthrough
      }
    }

    return `nostr://${npub}/${this.identifier}`;
  }

  /**
   * Convert to an naddr (NIP-19 addressable event identifier)
   *
   * @returns An naddr string
   *
   * @example
   * ```ts
   * const uri = new NostrURI({ pubkey: 'abc...', identifier: 'my-repo' });
   * const naddr = uri.toNaddr();
   * ```
   */
  toNaddr(): string {
    const data: {
      kind: number;
      pubkey: string;
      identifier: string;
      relays?: string[];
    } = {
      kind: 30617,
      pubkey: this.pubkey,
      identifier: this.identifier,
    };

    // Only add relays if we have a relay (avoid empty array)
    if (this.relay) {
      data.relays = [this.relay];
    }

    return nip19.naddrEncode(data);
  }

  /**
   * Create a NostrURI from an naddr (NIP-19 addressable event identifier)
   *
   * @param naddr - The naddr string to parse
   * @returns A NostrURI instance
   * @throws Error if the naddr is invalid or not an addressable event pointer
   *
   * @example
   * ```ts
   * const uri = NostrURI.fromNaddr('naddr1...');
   * console.log(uri.pubkey);
   * console.log(uri.identifier);
   * ```
   */
  static fromNaddr(naddr: string): NostrURI {
    try {
      const decoded = nip19.decode(naddr);

      if (decoded.type !== 'naddr') {
        throw new Error('Invalid naddr: must be an addressable event pointer');
      }

      const data = decoded.data;

      return new NostrURI({
        pubkey: data.pubkey,
        identifier: data.identifier,
        relay: data.relays?.[0], // Use first relay if available
      });
    } catch (error) {
      throw new Error(`Failed to parse naddr: ${error}`);
    }
  }

  /**
   * Convert to a JSON-serializable object with the component parts
   *
   * @returns The component parts of the URI
   */
  toJSON(): NostrURIParts {
    return {
      pubkey: this.pubkey,
      identifier: this.identifier,
      relay: this.relay,
    };
  }
}
