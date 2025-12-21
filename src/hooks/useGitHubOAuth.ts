import { useCallback } from 'react';
import { useOAuth, type OAuthConfig, type OAuthResult } from './useOAuth';
import { useGitSettings } from './useGitSettings';
import { proxyUrl } from '@/lib/proxyUrl';

interface GitHubUserInfo {
  login: string;
  id: number;
  avatar_url?: string;
  name?: string;
  email?: string;
  [key: string]: unknown;
}

/**
 * Hook for GitHub OAuth authentication.
 * Uses the generic useOAuth hook with GitHub-specific configuration.
 */
export function useGitHubOAuth() {
  const { addCredential, isInitialized } = useGitSettings();

  // GitHub OAuth configuration
  const config: OAuthConfig = {
    provider: 'github',
    clientId: import.meta.env.VITE_GITHUB_OAUTH_CLIENT_ID || '',
    clientSecret: import.meta.env.VITE_GITHUB_OAUTH_CLIENT_SECRET || '',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'repo workflow',
    redirectUri: window.location.origin + '/oauth/github',
    usePKCE: true, // GitHub supports PKCE
    getUserInfo: async (accessToken: string, corsProxy: string) => {
      const userUrl = proxyUrl(corsProxy, 'https://api.github.com/user');
      const userResponse = await fetch(userUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!userResponse.ok) {
        throw new Error(`Failed to verify GitHub token: ${userResponse.statusText}`);
      }

      const userData: GitHubUserInfo = await userResponse.json();
      return {
        username: userData.login,
        ...userData,
      };
    },
  };

  const oauth = useOAuth(config);

  /**
   * Handles the OAuth callback and stores the credentials in git settings.
   */
  const handleCallbackAndStore = useCallback(async (
    code: string,
    state: string
  ): Promise<boolean> => {
    // Wait for settings to be initialized before processing
    if (!isInitialized) {
      return false;
    }

    const result: OAuthResult | null = await oauth.handleCallback(code, state);

    if (!result) {
      return false;
    }

    // Store the credentials
    addCredential({
      id: crypto.randomUUID(),
      name: 'GitHub',
      origin: 'https://github.com',
      username: result.username || 'git',
      password: result.accessToken,
    });

    return true;
  }, [oauth, addCredential, isInitialized]);

  return {
    ...oauth,
    handleCallback: handleCallbackAndStore,
  };
}