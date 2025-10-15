export * from './types';
export { GitHubProvider } from './GitHubProvider';
export { GitLabProvider } from './GitLabProvider';
export { GiteaProvider } from './GiteaProvider';

import { GitHubProvider } from './GitHubProvider';
import { GitLabProvider } from './GitLabProvider';
import { GiteaProvider } from './GiteaProvider';
import { detectGitHost } from './types';
import type { GitHostProvider, GitHostConfig } from './types';

/**
 * Create a Git host provider instance based on the repository URL
 */
export function createGitHostProvider(
  url: string,
  config: GitHostConfig,
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
    
    default:
      return null;
  }
}
