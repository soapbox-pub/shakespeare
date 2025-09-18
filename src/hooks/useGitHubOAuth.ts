import { useState, useCallback } from 'react';
import { useGitSettings } from './useGitSettings';

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
  const { addCredential } = useGitSettings();

  // Check if OAuth is configured
  const isOAuthConfigured = !!(
    import.meta.env.VITE_GITHUB_OAUTH_CLIENT_ID &&
    import.meta.env.VITE_GITHUB_OAUTH_CLIENT_SECRET
  );

  const initiateOAuth = useCallback(() => {
    const clientId = import.meta.env.VITE_GITHUB_OAUTH_CLIENT_ID;

    if (!clientId) {
      setState(prev => ({ ...prev, error: 'GitHub OAuth client ID not configured' }));
      return;
    }

    // Generate a random state parameter for security
    const state = crypto.randomUUID();
    localStorage.setItem('github_oauth_state', state);

    // Redirect to GitHub OAuth
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: window.location.origin + '/oauth/github',
      scope: 'repo',
      state: state,
    });

    window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
  }, []);

  const handleCallback = useCallback(async (code: string, state: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Verify state parameter
      const storedState = localStorage.getItem('github_oauth_state');
      if (!storedState || storedState !== state) {
        throw new Error('Invalid OAuth state parameter');
      }

      // Clean up stored state
      localStorage.removeItem('github_oauth_state');

      const clientId = import.meta.env.VITE_GITHUB_OAUTH_CLIENT_ID;
      const clientSecret = import.meta.env.VITE_GITHUB_OAUTH_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error('GitHub OAuth credentials not configured');
      }

      // Exchange code for access token
      const tokenResponse = await fetch('https://corsproxy.io/?url=https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error(`GitHub OAuth token exchange failed: ${tokenResponse.statusText}`);
      }

      const tokenData: GitHubTokenResponse = await tokenResponse.json();

      if (!tokenData.access_token) {
        throw new Error('No access token received from GitHub');
      }

      // Get user info to verify the token works
      const userResponse = await fetch('https://corsproxy.io/?url=https://api.github.com/user', {
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
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'OAuth authentication failed'
      }));
      return false;
    }
  }, [addCredential]);

  return {
    ...state,
    isOAuthConfigured,
    initiateOAuth,
    handleCallback,
  };
}