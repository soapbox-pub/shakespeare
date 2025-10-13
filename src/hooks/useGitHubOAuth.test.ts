import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';
import { useGitHubOAuth } from './useGitHubOAuth';
import { TestApp } from '@/test/TestApp';
import { AppProvider } from '@/components/AppProvider';
import type { AppConfig } from '@/contexts/AppContext';

// Mock environment variables for testing
vi.stubEnv('VITE_GITHUB_OAUTH_CLIENT_ID', '********************');
vi.stubEnv('VITE_GITHUB_OAUTH_CLIENT_SECRET', '****************************************');

// Wrapper component to provide AppContext
function Wrapper({ children }: { children: React.ReactNode }) {
  const defaultConfig: AppConfig = {
    theme: 'light',
    relayUrl: 'wss://relay.test',
    projectTemplate: 'https://gitlab.com/soapbox-pub/mkstack.git',
    deployServer: 'test.com',
    esmUrl: 'https://esm.test',
    corsProxy: 'https://proxy.shakespeare.diy/?url={href}',
    previewDomain: 'local-test.dev',
    showcaseEnabled: true,
    showcaseModerator: 'npub1jvnpg4c6ljadf5t6ry0w9q0rnm4mksde87kglkrc993z46c39axsgq89sc',
  };

  return createElement(
    TestApp,
    null,
    createElement(
      AppProvider,
      { storageKey: 'test-app-config', defaultConfig, children }
    )
  );
}

// Mock crypto.subtle for PKCE testing
const mockCryptoSubtle = {
  digest: vi.fn(),
};

const mockCrypto = {
  getRandomValues: vi.fn(),
  randomUUID: vi.fn(),
  subtle: mockCryptoSubtle,
};

Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true,
});

// Mock btoa for base64 encoding
global.btoa = vi.fn((str: string) => Buffer.from(str, 'binary').toString('base64'));

describe('useGitHubOAuth PKCE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Setup crypto mocks
    mockCrypto.getRandomValues.mockImplementation((array: Uint8Array) => {
      // Fill with predictable values for testing
      for (let i = 0; i < array.length; i++) {
        array[i] = i % 256;
      }
      return array;
    });

    mockCrypto.randomUUID.mockReturnValue('test-state-uuid');

    // Mock SHA-256 digest to return predictable hash
    mockCryptoSubtle.digest.mockResolvedValue(
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32])
    );
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should validate state parameter in callback', async () => {
    // Setup stored state
    localStorage.setItem('github_oauth_state', 'correct-state');
    localStorage.setItem('github_oauth_code_verifier', 'test-verifier');

    const { result } = renderHook(() => useGitHubOAuth(), {
      wrapper: Wrapper,
    });

    // Mock fetch for token exchange and user info (using proxy URLs)
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'test-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ login: 'testuser' }),
      });

    global.fetch = mockFetch;

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handleCallback('test-code', 'correct-state');
    });

    expect(success).toBe(true);
    expect(localStorage.getItem('github_oauth_state')).toBeNull();
    expect(localStorage.getItem('github_oauth_code_verifier')).toBeNull();
  });

  it('should reject invalid state parameter', async () => {
    localStorage.setItem('github_oauth_state', 'correct-state');
    localStorage.setItem('github_oauth_code_verifier', 'test-verifier');

    const { result } = renderHook(() => useGitHubOAuth(), {
      wrapper: Wrapper,
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handleCallback('test-code', 'wrong-state');
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('Invalid OAuth state parameter');
    // Should clean up on error
    expect(localStorage.getItem('github_oauth_state')).toBeNull();
    expect(localStorage.getItem('github_oauth_code_verifier')).toBeNull();
  });

  it('should reject missing code verifier', async () => {
    localStorage.setItem('github_oauth_state', 'correct-state');
    // Don't set code verifier

    const { result } = renderHook(() => useGitHubOAuth(), {
      wrapper: Wrapper,
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handleCallback('test-code', 'correct-state');
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('PKCE code verifier not found. Please restart the OAuth flow.');
  });

  it('should include code_verifier in token request', async () => {
    localStorage.setItem('github_oauth_state', 'correct-state');
    localStorage.setItem('github_oauth_code_verifier', 'test-verifier');

    const { result } = renderHook(() => useGitHubOAuth(), {
      wrapper: Wrapper,
    });

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'test-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ login: 'testuser' }),
      });

    global.fetch = mockFetch;

    await act(async () => {
      await result.current.handleCallback('test-code', 'correct-state');
    });

    // Check that the token request includes the code verifier
    expect(mockFetch).toHaveBeenCalledWith(
      'https://proxy.shakespeare.diy/?url=https%3A%2F%2Fgithub.com%2Flogin%2Foauth%2Faccess_token',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"code_verifier":"test-verifier"'),
      })
    );
  });
});