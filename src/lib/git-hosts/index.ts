export * from './types';
export { GitHubProvider } from './GitHubProvider';
export { GitLabProvider } from './GitLabProvider';
export { GiteaProvider } from './GiteaProvider';
export { NostrGitProvider } from './NostrGitProvider';

import { GitHubProvider } from './GitHubProvider';
import { GitLabProvider } from './GitLabProvider';
import { GiteaProvider } from './GiteaProvider';
import { NostrGitProvider } from './NostrGitProvider';
import { detectGitHost } from './types';
import type { GitHostProvider, GitHostConfig } from './types';
import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Create a Git host provider instance based on the repository URL
 */
interface NostrSigner {
  signEvent: (event: { kind: number; content: string; tags: string[][]; created_at: number }) => Promise<NostrEvent>;
}

export function createGitHostProvider(
  url: string,
  config: GitHostConfig & { signer?: NostrSigner; pubkey?: string; relayUrls?: string[] },
  corsProxy?: string
): GitHostProvider | null {
  const hostType = detectGitHost(url);

  switch (hostType) {
    case 'github':
      return new GitHubProvider(config, corsProxy);

    case 'gitlab':
      return new GitLabProvider(config, corsProxy);

    case 'codeberg':
      return new GiteaProvider(config, 'https://codeberg.org/api/v1', 'Codeberg', corsProxy);

    case 'gitea':
      // Extract API URL from repository URL
      try {
        const parsed = new URL(url.replace(/^git@/, 'https://').replace(/\.git$/, ''));
        const apiUrl = `${parsed.protocol}//${parsed.hostname}/api/v1`;
        return new GiteaProvider(config, apiUrl, 'Gitea', corsProxy);
      } catch {
        return null;
      }

    case 'nostr':
      // Nostr git requires signer and pubkey
      if (!config.signer || !config.pubkey) {
        throw new Error('Nostr git requires signer and pubkey in config');
      }
      return new NostrGitProvider({
        token: config.token,
        signer: config.signer,
        pubkey: config.pubkey,
        relayUrls: config.relayUrls || ['wss://relay.nostr.band'],
      });

    default:
      return null;
  }
}
