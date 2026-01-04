import { useState, useCallback } from 'react';
import { useAISettings } from './useAISettings';
import type { AIProvider } from '@/contexts/AISettingsContext';

interface OpenRouterTokenResponse {
  key: string;
}

/**
 * Hook for OpenRouter OAuth authentication with PKCE.
 * OpenRouter uses a custom OAuth flow that differs from standard OAuth 2.0.
 * It uses PKCE without requiring client credentials.
 */
export function useOpenRouterOAuth() {
  const { setProvider, isLoading: isSettingsLoading } = useAISettings();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OpenRouter doesn't require client credentials - it uses PKCE only
  const isOAuthConfigured = true;

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
   * Initiates the OAuth flow by redirecting to OpenRouter's authorization page.
   */
  const initiateOAuth = useCallback(async () => {
    try {
      // Generate a random state parameter for security
      const state = crypto.randomUUID();
      const storagePrefix = 'openrouter_oauth';

      // Store state for later verification
      localStorage.setItem(`${storagePrefix}_state`, state);

      // Generate PKCE parameters
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      localStorage.setItem(`${storagePrefix}_code_verifier`, codeVerifier);

      // Build authorization URL
      const redirectUri = window.location.origin + '/oauth/openrouter';
      const params = new URLSearchParams({
        callback_url: redirectUri,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });

      // Redirect to OpenRouter's authorization page
      window.location.href = `https://openrouter.ai/auth?${params.toString()}`;
    } catch (error) {
      console.error('Failed to initiate OpenRouter OAuth:', error);
      setError('Failed to generate PKCE parameters. Please try again.');
    }
  }, []);

  /**
   * Handles the OAuth callback after the user authorizes the application.
   * Exchanges the authorization code for an API key.
   */
  const handleCallback = useCallback(async (
    code: string,
    _state: string
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    const storagePrefix = 'openrouter_oauth';

    try {
      // Get PKCE code verifier
      const codeVerifier = localStorage.getItem(`${storagePrefix}_code_verifier`);
      if (!codeVerifier) {
        throw new Error('PKCE code verifier not found. Please restart the OAuth flow.');
      }

      // Clean up stored values
      localStorage.removeItem(`${storagePrefix}_state`);
      localStorage.removeItem(`${storagePrefix}_code_verifier`);

      // Exchange code for API key using OpenRouter's custom endpoint
      const tokenResponse = await fetch('https://openrouter.ai/api/v1/auth/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
          code_verifier: codeVerifier,
          code_challenge_method: 'S256',
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`OpenRouter token exchange failed: ${tokenResponse.statusText} - ${errorText}`);
      }

      const tokenData: OpenRouterTokenResponse = await tokenResponse.json();

      if (!tokenData.key) {
        throw new Error('No API key received from OpenRouter');
      }

      // Wait for settings to be initialized before storing
      if (isSettingsLoading) {
        throw new Error('Settings not initialized. Please try again.');
      }

      // Create a new OpenRouter provider with the OAuth token
      const newProvider: AIProvider = {
        id: 'openrouter',
        name: 'OpenRouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: tokenData.key,
      };

      // Add or update the OpenRouter provider in settings
      setProvider(newProvider);

      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('OpenRouter OAuth error:', error);

      // Clean up any remaining OAuth data on error
      localStorage.removeItem(`${storagePrefix}_state`);
      localStorage.removeItem(`${storagePrefix}_code_verifier`);

      setError(error instanceof Error ? error.message : 'OAuth authentication failed');
      setIsLoading(false);
      return false;
    }
  }, [setProvider, isSettingsLoading]);

  return {
    isLoading,
    error,
    isOAuthConfigured,
    initiateOAuth,
    handleCallback,
  };
}

