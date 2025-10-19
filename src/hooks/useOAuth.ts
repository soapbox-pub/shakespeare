import { useState, useCallback } from 'react';
import { useAppContext } from './useAppContext';
import { proxyUrl } from '@/lib/proxyUrl';

export interface OAuthConfig {
  provider: 'github' | 'netlify' | 'vercel';
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope?: string;  // Optional - some providers don't use scopes
  redirectUri: string;
  usePKCE?: boolean;
  getUserInfo?: (accessToken: string, corsProxy: string) => Promise<{
    username: string;
    [key: string]: unknown;
  }>;
}

export interface OAuthState {
  isLoading: boolean;
  error: string | null;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  scope?: string;
  [key: string]: unknown;
}

export interface OAuthResult {
  accessToken: string;
  username?: string;
  scopes?: string[];
  userData?: Record<string, unknown>;
}

/**
 * Generic OAuth hook that handles the OAuth 2.0 flow with optional PKCE support.
 * This hook can be used for any OAuth provider by passing the appropriate configuration.
 */
export function useOAuth(config: OAuthConfig) {
  const [state, setState] = useState<OAuthState>({
    isLoading: false,
    error: null,
  });
  const { config: appConfig } = useAppContext();
  const { corsProxy } = appConfig;

  // Check if OAuth is configured
  const isOAuthConfigured = !!(config.clientId && config.clientSecret);

  // Generate a cryptographically secure random string for PKCE code verifier
  const generateCodeVerifier = (): string => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  // Create SHA-256 hash of the code verifier for PKCE code challenge
  const generateCodeChallenge = async (codeVerifier: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  /**
   * Initiates the OAuth flow by redirecting to the provider's authorization page.
   */
  const initiateOAuth = useCallback(async () => {
    if (!config.clientId) {
      setState(prev => ({ ...prev, error: `${config.provider} OAuth client ID not configured` }));
      return;
    }

    try {
      // Generate a random state parameter for security
      const state = crypto.randomUUID();
      const storagePrefix = `${config.provider}_oauth`;

      // Store state for later verification
      localStorage.setItem(`${storagePrefix}_state`, state);

      // Build authorization URL params
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        state: state,
        response_type: 'code',
      });

      // Add scope if provided (some providers don't use scopes)
      if (config.scope) {
        params.append('scope', config.scope);
      }

      // Add PKCE parameters if enabled
      if (config.usePKCE) {
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);

        localStorage.setItem(`${storagePrefix}_code_verifier`, codeVerifier);
        params.append('code_challenge', codeChallenge);
        params.append('code_challenge_method', 'S256');
      }

      // Redirect to provider's authorization page
      window.location.href = `${config.authorizeUrl}?${params.toString()}`;
    } catch (error) {
      console.error(`Failed to initiate ${config.provider} OAuth:`, error);
      setState(prev => ({
        ...prev,
        error: config.usePKCE
          ? 'Failed to generate PKCE parameters. Please try again.'
          : 'Failed to initiate OAuth. Please try again.'
      }));
    }
  }, [config]);

  /**
   * Handles the OAuth callback after the user authorizes the application.
   * Exchanges the authorization code for an access token.
   */
  const handleCallback = useCallback(async (
    code: string,
    state: string
  ): Promise<OAuthResult | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const storagePrefix = `${config.provider}_oauth`;

    try {
      // Verify state parameter
      const storedState = localStorage.getItem(`${storagePrefix}_state`);
      if (!storedState || storedState !== state) {
        throw new Error('Invalid OAuth state parameter');
      }

      // Build token request body
      const tokenRequestBody: Record<string, string> = {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: code,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      };

      // Add PKCE code verifier if enabled
      if (config.usePKCE) {
        const codeVerifier = localStorage.getItem(`${storagePrefix}_code_verifier`);
        if (!codeVerifier) {
          throw new Error('PKCE code verifier not found. Please restart the OAuth flow.');
        }
        tokenRequestBody.code_verifier = codeVerifier;
      }

      // Clean up stored values
      localStorage.removeItem(`${storagePrefix}_state`);
      if (config.usePKCE) {
        localStorage.removeItem(`${storagePrefix}_code_verifier`);
      }

      // Exchange code for access token
      const tokenUrl = proxyUrl(corsProxy, config.tokenUrl);
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tokenRequestBody),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`OAuth token exchange failed: ${tokenResponse.statusText} - ${errorText}`);
      }

      const tokenData: OAuthTokenResponse = await tokenResponse.json();

      if (!tokenData.access_token) {
        throw new Error('No access token received');
      }

      // Build result object
      const result: OAuthResult = {
        accessToken: tokenData.access_token,
        scopes: tokenData.scope ? tokenData.scope.split(/[\s,]+/).map(s => s.trim()).filter(Boolean) : [],
      };

      // Get user info if getUserInfo function is provided
      if (config.getUserInfo) {
        try {
          const userData = await config.getUserInfo(tokenData.access_token, corsProxy);
          result.username = userData.username;
          result.userData = userData;
        } catch (error) {
          console.warn(`Failed to fetch user info for ${config.provider}:`, error);
          // Continue without user info - it's optional
        }
      }

      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      console.error(`${config.provider} OAuth error:`, error);

      // Clean up any remaining OAuth data on error
      localStorage.removeItem(`${storagePrefix}_state`);
      if (config.usePKCE) {
        localStorage.removeItem(`${storagePrefix}_code_verifier`);
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'OAuth authentication failed'
      }));
      return null;
    }
  }, [config, corsProxy]);

  return {
    ...state,
    isOAuthConfigured,
    initiateOAuth,
    handleCallback,
  };
}
