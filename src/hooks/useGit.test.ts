import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGit } from './useGit';
import { useFS } from './useFS';
import { useGitSettings } from './useGitSettings';
import { Git } from '@/lib/git';
import type { JSRuntimeFS } from '@/lib/JSRuntime';
import type { NPool } from '@nostrify/nostrify';

// Mock the dependencies
vi.mock('./useFS');
vi.mock('./useGitSettings');
vi.mock('@nostrify/react', () => ({
  useNostr: vi.fn(),
}));
vi.mock('@/lib/git');

const mockUseFS = vi.mocked(useFS);
const mockUseGitSettings = vi.mocked(useGitSettings);
const MockGit = vi.mocked(Git);

// Import the mocked useNostr after mocking
import { useNostr } from '@nostrify/react';
const mockUseNostr = vi.mocked(useNostr);

describe('useGit', () => {
  const mockFS = {} as JSRuntimeFS;
  const mockNostr = {
    req: vi.fn(),
    query: vi.fn(),
    event: vi.fn(),
    group: vi.fn(),
    relay: vi.fn(),
    relays: new Map(),
    close: vi.fn(),
  } as unknown as NPool;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFS.mockReturnValue({ fs: mockFS });
    mockUseNostr.mockReturnValue({ nostr: mockNostr });
  });

  it('creates Git instance with default CORS proxy', () => {
    mockUseGitSettings.mockReturnValue({
      settings: {
        credentials: {},
        corsProxy: 'https://cors.isomorphic-git.org',
      },
      updateSettings: vi.fn(),
      addCredential: vi.fn(),
      removeCredential: vi.fn(),
      updateCredential: vi.fn(),
      isConfigured: false,
    });

    const { result } = renderHook(() => useGit());

    expect(MockGit).toHaveBeenCalledWith({
      fs: mockFS,
      nostr: mockNostr,
      corsProxy: 'https://cors.isomorphic-git.org',
    });
    expect(result.current).toEqual({ git: expect.any(Object) });
  });

  it('creates Git instance with custom CORS proxy', () => {
    mockUseGitSettings.mockReturnValue({
      settings: {
        credentials: {},
        corsProxy: 'https://custom-cors.example.com',
      },
      updateSettings: vi.fn(),
      addCredential: vi.fn(),
      removeCredential: vi.fn(),
      updateCredential: vi.fn(),
      isConfigured: false,
    });

    const { result } = renderHook(() => useGit());

    expect(MockGit).toHaveBeenCalledWith({
      fs: mockFS,
      nostr: mockNostr,
      corsProxy: 'https://custom-cors.example.com',
    });
    expect(result.current).toEqual({ git: expect.any(Object) });
  });

  it('recreates Git instance when CORS proxy changes', () => {
    // First render with default proxy
    mockUseGitSettings.mockReturnValue({
      settings: {
        credentials: {},
        corsProxy: 'https://cors.isomorphic-git.org',
      },
      updateSettings: vi.fn(),
      addCredential: vi.fn(),
      removeCredential: vi.fn(),
      updateCredential: vi.fn(),
      isConfigured: false,
    });

    const { rerender } = renderHook(() => useGit());
    expect(MockGit).toHaveBeenCalledWith({
      fs: mockFS,
      nostr: mockNostr,
      corsProxy: 'https://cors.isomorphic-git.org',
    });

    // Second render with custom proxy
    mockUseGitSettings.mockReturnValue({
      settings: {
        credentials: {},
        corsProxy: 'https://custom-cors.example.com',
      },
      updateSettings: vi.fn(),
      addCredential: vi.fn(),
      removeCredential: vi.fn(),
      updateCredential: vi.fn(),
      isConfigured: false,
    });

    rerender();
    expect(MockGit).toHaveBeenLastCalledWith({
      fs: mockFS,
      nostr: mockNostr,
      corsProxy: 'https://custom-cors.example.com',
    });
  });
});