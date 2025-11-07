import type { EventTemplate } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

export interface RepositoryAnnouncementData {
  /** Repository identifier (d tag) */
  repoId: string;
  /** Human-readable name */
  name?: string;
  /** Description of the repository */
  description?: string;
  /** Web URLs where repository can be browsed */
  webUrls?: string[];
  /** Clone URLs for the repository */
  cloneUrls: string[];
  /** Relays for patch submissions */
  relays?: string[];
  /** Earliest unique commit (root commit) */
  earliestCommit?: string;
}

/**
 * Parsed NIP-34 repository announcement with categorized data
 */
export interface RepositoryAnnouncement {
  /** Repository identifier (d tag) */
  identifier: string;
  /** Human-readable name */
  name?: string;
  /** Description of the repository */
  description?: string;
  /** Web URLs where repository can be browsed */
  webUrls: string[];
  /** All clone URLs (https) - to support http we would need to store graspServers with ws|wss:// prefix */
  httpsCloneUrls: string[];
  /** valid ws:// or wss:// Repository relay URLs*/
  relays: string[];
  /** Earliest unique commit (root commit SHA) */
  earliestCommit?: string;
  /** Maintainer public keys */
  maintainers: string[];
  /** GRASP servers (hostname only) - servers that appear in both clone and relays with valid pattern */
  graspServers: string[];
  /** Clone URLs that are NOT GRASP servers */
  nonGraspHttpsCloneUrls: string[];
  /** Relay URLs that are NOT GRASP servers */
  nonGraspRelays: string[];
  /** Raw event for advanced use */
  event: NostrEvent;
}

/**
 * Creates a NIP-34 repository announcement event (kind 30617)
 *
 * @param data - Repository announcement data
 * @returns Event template ready to be signed
 */
export function createRepositoryAnnouncementEvent(
  data: RepositoryAnnouncementData
): EventTemplate {
  // Build tags array per NIP-34
  const tags: string[][] = [
    ['d', data.repoId.trim()], // Required: repository identifier
  ];

  if (data.name?.trim()) {
    tags.push(['name', data.name.trim()]);
  }

  if (data.description?.trim()) {
    tags.push(['description', data.description.trim()]);
  }

  // Add web URLs (all in a single tag per NIP-34)
  if (data.webUrls && data.webUrls.length > 0) {
    const trimmedUrls = data.webUrls.map(url => url.trim()).filter(url => url);
    if (trimmedUrls.length > 0) {
      tags.push(['web', ...trimmedUrls]);
    }
  }

  // Add clone URLs (required, all in a single tag per NIP-34)
  if (data.cloneUrls.length > 0) {
    const trimmedUrls = data.cloneUrls.map(url => url.trim()).filter(url => url);
    if (trimmedUrls.length > 0) {
      tags.push(['clone', ...trimmedUrls]);
    }
  }

  // Add relays for patch submissions (all in a single tag per NIP-34)
  if (data.relays && data.relays.length > 0) {
    const trimmedRelays = data.relays.map(relay => relay.trim()).filter(relay => relay);
    if (trimmedRelays.length > 0) {
      tags.push(['relays', ...trimmedRelays]);
    }
  }

  // Add earliest unique commit (euc) for repository identification
  if (data.earliestCommit?.trim()) {
    tags.push(['r', data.earliestCommit.trim(), 'euc']);
  }

  // Create repository announcement event (kind 30617)
  return {
    kind: 30617,
    content: '',
    tags,
    created_at: Math.floor(Date.now() / 1000),
  };
}

/**
 * Creates a naddr (NIP-19 addressable event identifier) for a repository
 *
 * @param repoId - Repository identifier
 * @param pubkey - Repository owner's public key
 * @param relays - Optional relay hints
 * @returns naddr string
 */
export function createRepositoryNaddr(
  repoId: string,
  pubkey: string,
  relays?: string[]
): string {
  return nip19.naddrEncode({
    identifier: repoId.trim(),
    pubkey,
    kind: 30617,
    relays: relays && relays.length > 0 ? relays : undefined,
  });
}

/**
 * Validates repository ID according to NIP-34 standards
 * Repository IDs should be kebab-case short names
 *
 * @param repoId - Repository ID to validate
 * @throws Error if validation fails
 */
export function validateRepositoryId(repoId: string): void {
  if (!repoId || !repoId.trim()) {
    throw new Error('Repository ID is required');
  }

  const trimmedId = repoId.trim();

  // Check for valid kebab-case format
  // Should only contain lowercase letters, numbers, and hyphens
  // Should not start or end with a hyphen
  // Should not have consecutive hyphens
  const kebabCaseRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;

  if (!kebabCaseRegex.test(trimmedId)) {
    throw new Error(
      'Repository ID must be in kebab-case format (lowercase letters, numbers, and single hyphens only)'
    );
  }

  // Additional length check (reasonable limits)
  if (trimmedId.length < 2) {
    throw new Error('Repository ID must be at least 2 characters long');
  }

  if (trimmedId.length > 100) {
    throw new Error('Repository ID must be less than 100 characters');
  }
}

/**
 * Validates repository announcement data
 *
 * @param data - Repository announcement data to validate
 * @throws Error if validation fails
 */
export function validateRepositoryAnnouncementData(
  data: RepositoryAnnouncementData
): void {
  validateRepositoryId(data.repoId);

  if (data.cloneUrls.length === 0) {
    throw new Error('At least one clone URL is required');
  }
}

/**
 * Parses a NIP-34 repository announcement event (kind 30617) into a structured format.
 *
 * This function extracts all relevant data from the event tags and categorizes servers
 * into GRASP and non-GRASP categories. GRASP servers are identified by matching:
 * - clone tag contains URL(s) matching: [http|https]://<hostname>/<valid-npub>/<repo>.git
 * - relays tag contains URL(s) matching: [ws|wss]://<hostname>
 *
 * @param event - A kind 30617 repository announcement event
 * @returns Parsed repository data with categorized servers
 * @throws Error if event is not kind 30617
 *
 * @example
 * ```typescript
 * const repo = parseRepositoryAnnouncement(event);
 * console.log(repo.identifier); // "my-repo"
 * console.log(repo.graspServers); // ["git.example.com"]
 * console.log(repo.nonGraspCloneUrls); // ["https://github.com/user/repo.git"]
 * ```
 */
export function parseRepositoryAnnouncement(event: NostrEvent): RepositoryAnnouncement {
  if (event.kind !== 30617) {
    throw new Error(`Expected kind 30617, got ${event.kind}`);
  }

  // Extract basic fields
  const identifier = event.tags.find(([name]) => name === 'd')?.[1] || '';
  const name = event.tags.find(([name]) => name === 'name')?.[1];
  const description = event.tags.find(([name]) => name === 'description')?.[1];

  // Extract multi-value tags
  const webUrls: string[] = [];
  const httpsCloneUrls: string[] = [];
  const relays: string[] = [];
  const maintainers: string[] = [];
  let earliestCommit: string | undefined;

  // Track servers for GRASP detection
  const validCloneServers = new Set<string>(); // Servers with valid GRASP clone URLs
  const relayServers = new Set<string>(); // Servers in relays tags
  const cloneUrlsByServer = new Map<string, string[]>(); // Map hostname -> clone URLs
  const relayUrlsByServer = new Map<string, string[]>(); // Map hostname -> relay URLs

  for (const [name, ...values] of event.tags) {
    switch (name) {
      case 'web':
        // All values after tag name are web URLs
        for (const value of values) {
          if (value) {
            webUrls.push(value);
          }
        }
        break;

      case 'clone':
        // All values after tag name are clone URLs
        // Also track which ones match GRASP pattern
        for (const value of values) {
          if (value) {
            try {
              const url = new URL(value);

              // Only accept https:// URLs (reject http://)
              if (url.protocol === 'https:') {
                httpsCloneUrls.push(value); // Use original value to preserve exact format

                // Check if this matches GRASP pattern: https://<hostname>/<npub>/<repo>.git
                if ((value.endsWith('.git/') || value.endsWith('.git')) && value.includes('/npub1')) {
                  // Extract and validate the npub using nip19.decode
                  // Match npub1 followed by alphanumeric chars, ending at /
                  const npubMatch = value.match(/\/npub1([a-z0-9]+)\//);
                  if (npubMatch) {
                    const npub = `npub1${npubMatch[1]}`;
                    try {
                      const decoded = nip19.decode(npub);
                      if (decoded.type === 'npub') {
                        // Valid GRASP clone URL
                        validCloneServers.add(url.hostname);

                        if (!cloneUrlsByServer.has(url.hostname)) {
                          cloneUrlsByServer.set(url.hostname, []);
                        }
                        cloneUrlsByServer.get(url.hostname)!.push(value);
                      }
                    } catch {
                      // Invalid npub, not a GRASP server
                    }
                  }
                }
              }
            } catch {
              // Invalid URL, skip
            }
          }
        }
        break;

      case 'relays':
        // All values after tag name are relay URLs
        for (const value of values) {
          if (value) {
            try {
              const url = new URL(value);
              if (url.protocol === 'ws:' || url.protocol === 'wss:') {
                relays.push(value); // Use original value to preserve exact format
                relayServers.add(url.hostname);

                if (!relayUrlsByServer.has(url.hostname)) {
                  relayUrlsByServer.set(url.hostname, []);
                }
                relayUrlsByServer.get(url.hostname)!.push(value);
              }
            } catch {
              // Invalid URL, skip
            }
          }
        }
        break;

      case 'maintainers':
        // All values after tag name are maintainer pubkeys
        for (const value of values) {
          if (value) {
            maintainers.push(value);
          }
        }
        break;

      case 'r':
        // Check for earliest unique commit marker
        if (values.length >= 2 && values[1] === 'euc') {
          earliestCommit = values[0];
        }
        break;
    }
  }

  // Identify GRASP servers: must appear in BOTH clone (with valid pattern) and relays
  const graspServers = [...validCloneServers].filter(server =>
    relayServers.has(server)
  );

  // Categorize clone URLs
  const nonGraspHttpsCloneUrls = httpsCloneUrls.filter(url => {
    try {
      const hostname = new URL(url).hostname;
      return !graspServers.includes(hostname);
    } catch {
      return true; // Invalid URLs go to non-GRASP
    }
  });

  // Categorize relay URLs
  const nonGraspRelays = relays.filter(url => {
    try {
      const hostname = new URL(url).hostname;
      return !graspServers.includes(hostname);
    } catch {
      return true; // Invalid URLs go to non-GRASP
    }
  });

  return {
    identifier,
    name,
    description,
    webUrls,
    httpsCloneUrls,
    relays,
    earliestCommit,
    maintainers,
    graspServers,
    nonGraspHttpsCloneUrls,
    nonGraspRelays,
    event,
  };
}
