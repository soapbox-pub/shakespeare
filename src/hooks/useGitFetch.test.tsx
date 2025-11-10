import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGitFetch } from './useGitFetch';
import { TestApp } from '@/test/TestApp';

// Mock the git operations
vi.mock('./useGit', () => ({
  useGit: () => ({
    git: {
      findRoot: vi.fn().mockResolvedValue('/projects/test-project'),
      listRemotes: vi.fn().mockResolvedValue([
        { remote: 'origin', url: 'https://github.com/test/repo.git' }
      ]),
      currentBranch: vi.fn().mockResolvedValue('main'),
      getRemoteInfo: vi.fn().mockResolvedValue({
        refs: {
          HEAD: {
            type: 'symref',
            target: 'refs/heads/main',
          },
        },
      }),
      resolveRef: vi.fn()
        .mockResolvedValueOnce('abc123') // before default
        .mockResolvedValueOnce('abc123') // before current
        .mockResolvedValueOnce('abc123') // after default
        .mockResolvedValueOnce('abc123'), // after current
      fetch: vi.fn().mockResolvedValue(undefined),
    },
  }),
}));

vi.mock('./useGitSettings', () => ({
  useGitSettings: () => ({
    settings: {
      credentials: [],
    },
  }),
}));

vi.mock('./useFSPaths', () => ({
  useFSPaths: () => ({
    projectsPath: '/projects',
  }),
}));

describe('useGitFetch', () => {
  it('returns null state when projectId is null', async () => {
    const { result } = renderHook(() => useGitFetch(null), {
      wrapper: TestApp,
    });

    // When projectId is null, the query is disabled and won't fetch
    // So we just check the initial state
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isSuccess).toBe(false);
  });

  it('fetches remote updates successfully', async () => {
    const { result } = renderHook(() => useGitFetch('test-project'), {
      wrapper: TestApp,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toMatchObject({
      defaultBranch: 'main',
      currentBranch: 'main',
      remoteUrl: 'https://github.com/test/repo.git',
      hasChanges: false,
    });
  });

  it('can be manually refetched', async () => {
    const { result } = renderHook(() => useGitFetch('test-project'), {
      wrapper: TestApp,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const firstFetchTime = result.current.data?.fetchedAt;

    // Manually trigger refetch
    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.data?.fetchedAt).toBeGreaterThanOrEqual(firstFetchTime || 0);
    });
  });
});
