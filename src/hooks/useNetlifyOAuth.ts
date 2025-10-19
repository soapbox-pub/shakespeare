import { useCallback } from 'react';
import { useOAuth, type OAuthConfig, type OAuthResult } from './useOAuth';
import { useDeploySettings } from './useDeploySettings';
import { proxyUrl } from '@/lib/proxyUrl';
import type { NetlifyProvider } from '@/contexts/DeploySettingsContext';

interface NetlifyUserInfo {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  [key: string]: unknown;
}

/**
 * Hook for Netlify OAuth authentication.
 * Uses the generic useOAuth hook with Netlify-specific configuration.
 */
export function useNetlifyOAuth() {
  const { setProviders, settings } = useDeploySettings();

  // Netlify OAuth configuration
  const config: OAuthConfig = {
    provider: 'netlify',
    clientId: import.meta.env.VITE_NETLIFY_OAUTH_CLIENT_ID || '',
    clientSecret: import.meta.env.VITE_NETLIFY_OAUTH_CLIENT_SECRET || '',
    authorizeUrl: 'https://app.netlify.com/authorize',
    tokenUrl: 'https://api.netlify.com/oauth/token',
    // Netlify doesn't use scope parameter - permissions are configured in the OAuth app settings
    redirectUri: window.location.origin + '/oauth/netlify',
    usePKCE: false, // Netlify doesn't support PKCE
    getUserInfo: async (accessToken: string, corsProxy: string) => {
      const userUrl = proxyUrl(corsProxy, 'https://api.netlify.com/api/v1/user');
      const userResponse = await fetch(userUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error(`Failed to verify Netlify token: ${userResponse.statusText}`);
      }

      const userData: NetlifyUserInfo = await userResponse.json();
      return {
        username: userData.email || userData.full_name || 'Netlify User',
        ...userData,
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
    const result: OAuthResult | null = await oauth.handleCallback(code, state);

    if (!result) {
      return false;
    }

    // Create a new Netlify provider with the OAuth token
    // Use the preset ID 'netlify' for OAuth-added providers
    const newProvider: NetlifyProvider = {
      id: 'netlify',
      name: result.username ? `Netlify (${result.username})` : 'Netlify',
      type: 'netlify',
      apiKey: result.accessToken,
      proxy: true, // Netlify typically requires CORS proxy
    };

    // Add the new provider to settings
    setProviders([...settings.providers, newProvider]);

    return true;
  }, [oauth, setProviders, settings.providers]);

  return {
    ...oauth,
    handleCallback: handleCallbackAndStore,
  };
}
