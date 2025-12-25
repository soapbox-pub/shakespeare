import type { GitCredential } from '@/contexts/GitSettingsContext';

/**
 * Get the effective port for a URL (considering defaults)
 */
function getEffectivePort(url: URL): number | undefined {
  if (url.port) {
    return parseInt(url.port);
  }
  switch (url.protocol) {
    case 'http:':
      return 80;
    case 'https:':
      return 443;
  }
}

/**
 * Match a URL against a credential
 * Returns true if the credential matches the URL
 */
function matchesCredential(
  credential: GitCredential,
  url: URL,
): boolean {
  const targetURL = new URL(url);
  const credURL = new URL(credential.origin);

  // 1. Protocol must match exactly
  if (credURL.protocol !== targetURL.protocol) {
    return false;
  }

  // 2. Hostname must match exactly
  if (credURL.hostname !== targetURL.hostname) {
    return false;
  }

  // 3. Port must match exactly (after default conversion)
  if (getEffectivePort(credURL) !== getEffectivePort(targetURL)) {
    return false;
  }

  // 4. Username must match if both are specified
  if (credential.username && targetURL.username) {
    if (credential.username !== targetURL.username) {
      return false;
    }
  }

  return true;
}

/**
 * Find the best matching credential for a URL from a list of credentials
 * Returns the credential with username match preferred over no username
 */
export function findCredentialsForRepo(
  url: string | URL,
  credentials: GitCredential[],
): GitCredential | undefined {
  url = new URL(url);
  const matches = credentials.filter(cred => matchesCredential(cred, url));

  if (matches.length === 0) {
    return undefined;
  }

  // Prefer credentials with matching username
  const withUsername = matches.find(
    cred => cred.username && cred.username === url.username,
  );

  return withUsername ?? matches[0];
}