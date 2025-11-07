import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null state when projectId is null', async () => {
    const { result } = renderHook(() => useGitFetch(null), {
      wrapper: TestApp,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      defaultBranch: null,
      defaultBranchOid: null,
      currentBranch: null,
      currentBranchOid: null,
      fetchedAt: expect.any(Number),
      hasChanges: false,
      remoteUrl: null,
    });
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

  it('can be manually refetched when data is stale', async () => {
    const { result } = renderHook(() => useGitFetch('test-project'), {
      wrapper: TestApp,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const firstFetchTime = result.current.data?.fetchedAt;

    // Advance time to make data stale
    vi.advanceTimersByTime(31000);

    // Manually trigger refetch
    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.data?.fetchedAt).toBeGreaterThan(firstFetchTime || 0);
    });
  });

  it('automatically refetches every 60 seconds', async () => {
    const { result } = renderHook(() => useGitFetch('test-project'), {
      wrapper: TestApp,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const firstFetchTime = result.current.data?.fetchedAt || 0;

    // Advance time by 60 seconds
    vi.advanceTimersByTime(60000);

    await waitFor(() => {
      expect(result.current.data?.fetchedAt).toBeGreaterThan(firstFetchTime);
    });
  });
});
