import { useCallback } from 'react';
import { useOAuth, type OAuthConfig, type OAuthResult } from './useOAuth';
import { useDeploySettings } from './useDeploySettings';
import { proxyUrl } from '@/lib/proxyUrl';
import type { VercelProvider } from '@/contexts/DeploySettingsContext';

interface VercelUserInfo {
  user: {
    id: string;
    email: string;
    name?: string;
    username?: string;
    avatar?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Hook for Vercel OAuth authentication.
 * Uses the generic useOAuth hook with Vercel-specific configuration.
 */
export function useVercelOAuth() {
  const { setProviders, settings, isInitialized } = useDeploySettings();

  // Vercel OAuth configuration
  const config: OAuthConfig = {
    provider: 'vercel',
    clientId: import.meta.env.VITE_VERCEL_OAUTH_CLIENT_ID || '',
    clientSecret: import.meta.env.VITE_VERCEL_OAUTH_CLIENT_SECRET || '',
    authorizeUrl: 'https://vercel.com/oauth/authorize',
    tokenUrl: 'https://api.vercel.com/v2/oauth/access_token',
    scope: 'deployments:write deployments:read projects:read projects:write',
    redirectUri: window.location.origin + '/oauth/vercel',
    usePKCE: false, // Vercel doesn't require PKCE
    getUserInfo: async (accessToken: string, corsProxy: string) => {
      const userUrl = proxyUrl({ template: corsProxy, url: 'https://api.vercel.com/v2/user' });
      const userResponse = await fetch(userUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error(`Failed to verify Vercel token: ${userResponse.statusText}`);
      }

      const userData: VercelUserInfo = await userResponse.json();
      return {
        username: userData.user.username || userData.user.email || userData.user.name || 'Vercel User',
        ...userData.user,
      };
    },
  };

  const oauth = useOAuth(config);

  /**
   * Handles the OAuth callback and stores the credentials in deploy settings.
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

    // Create a new Vercel provider with the OAuth token
    // Use the preset ID 'vercel' for OAuth-added providers
    const newProvider: VercelProvider = {
      id: 'vercel',
      name: result.username ? `Vercel (${result.username})` : 'Vercel',
      type: 'vercel',
      apiKey: result.accessToken,
      proxy: true, // Vercel typically requires CORS proxy
    };

    // Add the new provider to settings
    setProviders([...settings.providers, newProvider]);

    return true;
  }, [oauth, setProviders, settings.providers, isInitialized]);

  return {
    ...oauth,
    handleCallback: handleCallbackAndStore,
  };
}
