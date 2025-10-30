import type { EventTemplate } from 'nostr-tools';
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
