import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGit } from './useGit';
import { useFS } from './useFS';
import { useGitSettings } from './useGitSettings';
import { Git } from '@/lib/git';
import type { JSRuntimeFS } from '@/lib/JSRuntime';

// Mock the dependencies
vi.mock('./useFS');
vi.mock('./useGitSettings');
vi.mock('@/lib/git');

const mockUseFS = vi.mocked(useFS);
const mockUseGitSettings = vi.mocked(useGitSettings);
const MockGit = vi.mocked(Git);

describe('useGit', () => {
  const mockFS = {} as JSRuntimeFS;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFS.mockReturnValue({ fs: mockFS });
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

    renderHook(() => useGit());

    expect(MockGit).toHaveBeenCalledWith(mockFS, 'https://cors.isomorphic-git.org');
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

    renderHook(() => useGit());

    expect(MockGit).toHaveBeenCalledWith(mockFS, 'https://custom-cors.example.com');
  });

  it('recreates Git instance when CORS proxy changes', () => {
    const { rerender } = renderHook(() => useGit());

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

    rerender();
    expect(MockGit).toHaveBeenCalledWith(mockFS, 'https://cors.isomorphic-git.org');

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
    expect(MockGit).toHaveBeenLastCalledWith(mockFS, 'https://custom-cors.example.com');
  });
});