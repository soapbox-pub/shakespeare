import type { GitCredential } from '@/contexts/GitSettingsContext';

/**
 * Extract the origin (protocol + hostname + port) from a Git URL
 */
export function extractGitOrigin(gitUrl: string): string | null {
  try {
    // Handle SSH URLs like git@github.com:user/repo.git
    if (gitUrl.startsWith('git@')) {
      const match = gitUrl.match(/^git@([^:]+):/);
      if (match) {
        return `https://${match[1]}`;
      }
    }

    // Handle HTTP/HTTPS URLs
    if (gitUrl.startsWith('http://') || gitUrl.startsWith('https://')) {
      const url = new URL(gitUrl);
      return `${url.protocol}//${url.host}`;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Find matching credentials for a repository URL
 */
export function findCredentialsForRepo(
  repoUrl: string,
  credentials: Record<string, GitCredential>
): GitCredential | null {
  const repoOrigin = extractGitOrigin(repoUrl);
  if (!repoOrigin) return null;

  // Direct match
  if (credentials[repoOrigin]) {
    return credentials[repoOrigin];
  }

  // Try to find a match by normalizing common variations
  const normalizedRepoOrigin = repoOrigin.toLowerCase();

  for (const [origin, credential] of Object.entries(credentials)) {
    const normalizedOrigin = origin.toLowerCase();

    // Exact match (case-insensitive)
    if (normalizedOrigin === normalizedRepoOrigin) {
      return credential;
    }

    // Handle www variations
    if (normalizedOrigin.replace(/^https?:\/\/www\./, 'https://') ===
        normalizedRepoOrigin.replace(/^https?:\/\/www\./, 'https://')) {
      return credential;
    }
  }

  return null;
}

/**
 * Get the display name for a Git origin URL
 */
export function getOriginDisplayName(origin: string): string {
  try {
    const url = new URL(origin);
    return url.host; // Use host instead of hostname to include port
  } catch {
    return origin;
  }
}