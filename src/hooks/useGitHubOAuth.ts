import { useState, useCallback } from 'react';
import { useGitSettings } from './useGitSettings';
import { proxyUrl } from '@/lib/proxyUrl';

interface GitHubOAuthState {
  isLoading: boolean;
  error: string | null;
}

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export function useGitHubOAuth() {
  const [state, setState] = useState<GitHubOAuthState>({
    isLoading: false,
    error: null,
  });
  const { settings, addCredential } = useGitSettings();
  const { corsProxy } = settings;

  // Check if OAuth is configured
  const isOAuthConfigured = !!(
    import.meta.env.VITE_GITHUB_OAUTH_CLIENT_ID &&
    import.meta.env.VITE_GITHUB_OAUTH_CLIENT_SECRET
  );

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

  const initiateOAuth = useCallback(async () => {
    const clientId = import.meta.env.VITE_GITHUB_OAUTH_CLIENT_ID;

    if (!clientId) {
      setState(prev => ({ ...prev, error: 'GitHub OAuth client ID not configured' }));
      return;
    }

    try {
      // Generate PKCE parameters
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      // Generate a random state parameter for security
      const state = crypto.randomUUID();

      // Store both state and code verifier for later use
      localStorage.setItem('github_oauth_state', state);
      localStorage.setItem('github_oauth_code_verifier', codeVerifier);

      // Redirect to GitHub OAuth with PKCE parameters
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: window.location.origin + '/oauth/github',
        scope: 'repo workflow',
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });

      window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
    } catch (error) {
      console.error('Failed to initiate OAuth with PKCE:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to generate PKCE parameters. Please try again.'
      }));
    }
  }, []);

  const handleCallback = useCallback(async (code: string, state: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Verify state parameter
      const storedState = localStorage.getItem('github_oauth_state');
      if (!storedState || storedState !== state) {
        throw new Error('Invalid OAuth state parameter');
      }

      // Get the stored code verifier for PKCE
      const codeVerifier = localStorage.getItem('github_oauth_code_verifier');
      if (!codeVerifier) {
        throw new Error('PKCE code verifier not found. Please restart the OAuth flow.');
      }

      // Clean up stored values
      localStorage.removeItem('github_oauth_state');
      localStorage.removeItem('github_oauth_code_verifier');

      const clientId = import.meta.env.VITE_GITHUB_OAUTH_CLIENT_ID;
      const clientSecret = import.meta.env.VITE_GITHUB_OAUTH_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error('GitHub OAuth credentials not configured');
      }

      // Exchange code for access token with PKCE code verifier
      const tokenRequestBody = {
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: window.location.origin + '/oauth/github',
        code_verifier: codeVerifier,
      };

      const tokenUrl = proxyUrl(corsProxy, 'https://github.com/login/oauth/access_token');
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tokenRequestBody),
      });

      if (!tokenResponse.ok) {
        throw new Error(`GitHub OAuth token exchange failed: ${tokenResponse.statusText}`);
      }

      const tokenData: GitHubTokenResponse = await tokenResponse.json();

      if (!tokenData.access_token) {
        throw new Error('No access token received from GitHub');
      }

      // Get user info to verify the token works
      const userUrl = proxyUrl(corsProxy, 'https://api.github.com/user');
      const userResponse = await fetch(userUrl, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!userResponse.ok) {
        throw new Error(`Failed to verify GitHub token: ${userResponse.statusText}`);
      }

      const userData = await userResponse.json();

      // Store the credentials
      addCredential('https://github.com', {
        username: userData.login || 'git',
        password: tokenData.access_token,
      });

      setState(prev => ({ ...prev, isLoading: false }));
      return true;
    } catch (error) {
      console.error('GitHub OAuth error:', error);

      // Clean up any remaining OAuth data on error
      localStorage.removeItem('github_oauth_state');
      localStorage.removeItem('github_oauth_code_verifier');

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'OAuth authentication failed'
      }));
      return false;
    }
  }, [addCredential, corsProxy]);

  return {
    ...state,
    isOAuthConfigured,
    initiateOAuth,
    handleCallback,
  };
}