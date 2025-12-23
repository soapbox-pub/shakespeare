import { NostrURI } from '@/lib/NostrURI';
import { findCredentialsForRepo } from '@/lib/gitCredentials';
import type { GitCredential } from '@/contexts/GitSettingsContext';

/**
 * Detect if a repository URL should be treated as a fork
 * 
 * For Nostr URIs: A repository is a fork if the owner's pubkey differs from the current user's pubkey
 * For HTTPS URLs: A repository is a fork if the URL doesn't match ${credential.origin}/${credential.username}/
 * 
 * @param repoUrl - The repository URL (Nostr URI or HTTPS)
 * @param currentUserPubkey - The current user's Nostr pubkey (optional)
 * @param gitCredentials - Array of Git credentials (optional)
 * @returns true if the repository should be treated as a fork, false otherwise
 */
export async function detectFork(
  repoUrl: string,
  currentUserPubkey?: string,
  gitCredentials: GitCredential[] = [],
): Promise<boolean> {
  // Default to not a fork
  let fork = false;

  if (repoUrl.startsWith('nostr://')) {
    // For Nostr URIs: check if the repository owner is different from current user
    if (currentUserPubkey) {
      try {
        const nostrURI = await NostrURI.parse(repoUrl);
        fork = nostrURI.pubkey !== currentUserPubkey;
      } catch {
        // If parsing fails, default to fork=false
        fork = false;
      }
    }
  } else if (repoUrl.startsWith('http://') || repoUrl.startsWith('https://')) {
    // For HTTPS URLs: check if the URL belongs to the user based on credentials
    // A repository is NOT a fork if it starts with ${credential.origin}/${credential.username}/
    const credential = findCredentialsForRepo(repoUrl, gitCredentials);

    if (credential) {
      const expectedPrefix = `${credential.origin}/${credential.username}/`;
      fork = !repoUrl.startsWith(expectedPrefix);
    } else {
      // No matching credentials found, treat as fork
      fork = true;
    }
  }

  return fork;
}
