import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGitFetch } from './useGitFetch';
import { TestApp } from '@/test/TestApp';

// Create mocks that can be reconfigured per test
const mockGit = {
  findRoot: vi.fn(),
  listRemotes: vi.fn(),
  currentBranch: vi.fn(),
  resolveRef: vi.fn(),
  fetch: vi.fn(),
};

const mockToast = vi.fn();
const mockInvalidateQueries = vi.fn();

// Mock the git operations
vi.mock('./useGit', () => ({
  useGit: () => ({
    git: mockGit,
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

vi.mock('./useToast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock QueryClient to track invalidateQueries calls
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  };
});

describe('useGitFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToast.mockClear();
    mockInvalidateQueries.mockClear();
  });

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

  it('fetches remote updates successfully when default branch is checked out', async () => {
    // Setup mocks for default branch scenario
    mockGit.findRoot.mockResolvedValue('/projects/test-project');
    mockGit.listRemotes.mockResolvedValue([
      { remote: 'origin', url: 'https://github.com/test/repo.git' }
    ]);
    mockGit.currentBranch.mockResolvedValue('main');
    mockGit.fetch.mockResolvedValue(undefined);

    // Mock resolveRef calls in order:
    // 1. Read symbolic ref for default branch (returns the ref path)
    // 2. Get default branch OID before fetch
    // 3. Get current branch OID before fetch
    // 4. Get default branch OID after fetch
    // 5. Get current branch OID after fetch
    mockGit.resolveRef
      .mockResolvedValueOnce('ref: refs/remotes/origin/main') // symbolic ref
      .mockResolvedValueOnce('abc123') // before default
      .mockResolvedValueOnce('abc123') // before current (same as default)
      .mockResolvedValueOnce('abc123') // after default
      .mockResolvedValueOnce('abc123'); // after current (same as default)

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

    // Verify fetch was called
    expect(mockGit.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        dir: '/projects/test-project',
        remote: 'origin',
      })
    );
  });

  it('fetches remote updates successfully when non-default branch is checked out', async () => {
    // Setup mocks for non-default branch scenario
    mockGit.findRoot.mockResolvedValue('/projects/test-project');
    mockGit.listRemotes.mockResolvedValue([
      { remote: 'origin', url: 'https://github.com/test/repo.git' }
    ]);
    mockGit.currentBranch.mockResolvedValue('feature-branch');
    mockGit.fetch.mockResolvedValue(undefined);

    // Mock resolveRef calls in order:
    // 1. Read symbolic ref for default branch (returns the ref path)
    // 2. Get default branch OID before fetch
    // 3. Get current branch OID before fetch
    // 4. Get default branch OID after fetch
    // 5. Get current branch OID after fetch
    mockGit.resolveRef
      .mockResolvedValueOnce('ref: refs/remotes/origin/main') // symbolic ref
      .mockResolvedValueOnce('abc123') // before default (main)
      .mockResolvedValueOnce('def456') // before current (feature-branch)
      .mockResolvedValueOnce('abc123') // after default (main)
      .mockResolvedValueOnce('def456'); // after current (feature-branch)

    const { result } = renderHook(() => useGitFetch('test-project'), {
      wrapper: TestApp,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toMatchObject({
      defaultBranch: 'main',
      currentBranch: 'feature-branch',
      remoteUrl: 'https://github.com/test/repo.git',
      hasChanges: false,
    });

    // Verify fetch was called
    expect(mockGit.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        dir: '/projects/test-project',
        remote: 'origin',
      })
    );
  });

  it('detects changes on default branch when checked out', async () => {
    // Setup mocks
    mockGit.findRoot.mockResolvedValue('/projects/test-project');
    mockGit.listRemotes.mockResolvedValue([
      { remote: 'origin', url: 'https://github.com/test/repo.git' }
    ]);
    mockGit.currentBranch.mockResolvedValue('main');
    mockGit.fetch.mockResolvedValue(undefined);

    // Mock resolveRef to simulate changes on default branch
    mockGit.resolveRef
      .mockResolvedValueOnce('ref: refs/remotes/origin/main') // symbolic ref
      .mockResolvedValueOnce('abc123') // before default
      .mockResolvedValueOnce('abc123') // before current (same as default)
      .mockResolvedValueOnce('xyz789') // after default (changed!)
      .mockResolvedValueOnce('xyz789'); // after current (changed!)

    const { result } = renderHook(() => useGitFetch('test-project'), {
      wrapper: TestApp,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toMatchObject({
      defaultBranch: 'main',
      currentBranch: 'main',
      hasChanges: true, // Changes detected on default branch
    });
  });

  it('detects changes on non-default branch when checked out', async () => {
    // Setup mocks
    mockGit.findRoot.mockResolvedValue('/projects/test-project');
    mockGit.listRemotes.mockResolvedValue([
      { remote: 'origin', url: 'https://github.com/test/repo.git' }
    ]);
    mockGit.currentBranch.mockResolvedValue('feature-branch');
    mockGit.fetch.mockResolvedValue(undefined);

    // Mock resolveRef to simulate changes on non-default branch
    mockGit.resolveRef
      .mockResolvedValueOnce('ref: refs/remotes/origin/main') // symbolic ref
      .mockResolvedValueOnce('abc123') // before default
      .mockResolvedValueOnce('def456') // before current
      .mockResolvedValueOnce('abc123') // after default (no change)
      .mockResolvedValueOnce('xyz789'); // after current (changed!)

    const { result } = renderHook(() => useGitFetch('test-project'), {
      wrapper: TestApp,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toMatchObject({
      defaultBranch: 'main',
      currentBranch: 'feature-branch',
      hasChanges: true, // Changes detected on current branch
    });
  });

  it('detects changes on both default and non-default branches', async () => {
    // Setup mocks
    mockGit.findRoot.mockResolvedValue('/projects/test-project');
    mockGit.listRemotes.mockResolvedValue([
      { remote: 'origin', url: 'https://github.com/test/repo.git' }
    ]);
    mockGit.currentBranch.mockResolvedValue('feature-branch');
    mockGit.fetch.mockResolvedValue(undefined);

    // Mock resolveRef to simulate changes on both branches
    mockGit.resolveRef
      .mockResolvedValueOnce('ref: refs/remotes/origin/main') // symbolic ref
      .mockResolvedValueOnce('abc123') // before default
      .mockResolvedValueOnce('def456') // before current
      .mockResolvedValueOnce('new111') // after default (changed!)
      .mockResolvedValueOnce('new222'); // after current (changed!)

    const { result } = renderHook(() => useGitFetch('test-project'), {
      wrapper: TestApp,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toMatchObject({
      defaultBranch: 'main',
      currentBranch: 'feature-branch',
      hasChanges: true, // Changes detected on both branches
    });
  });

  it('detects changes on default branch when non-default branch is checked out', async () => {
    // Setup mocks
    mockGit.findRoot.mockResolvedValue('/projects/test-project');
    mockGit.listRemotes.mockResolvedValue([
      { remote: 'origin', url: 'https://github.com/test/repo.git' }
    ]);
    mockGit.currentBranch.mockResolvedValue('feature-branch');
    mockGit.fetch.mockResolvedValue(undefined);

    // Mock resolveRef to simulate changes on default branch only
    mockGit.resolveRef
      .mockResolvedValueOnce('ref: refs/remotes/origin/main') // symbolic ref
      .mockResolvedValueOnce('abc123') // before default
      .mockResolvedValueOnce('def456') // before current
      .mockResolvedValueOnce('xyz789') // after default (changed!)
      .mockResolvedValueOnce('def456'); // after current (no change)

    const { result } = renderHook(() => useGitFetch('test-project'), {
      wrapper: TestApp,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toMatchObject({
      defaultBranch: 'main',
      currentBranch: 'feature-branch',
      hasChanges: true, // Changes detected on default branch
    });
  });

  it('can be manually refetched', async () => {
    // Setup mocks
    mockGit.findRoot.mockResolvedValue('/projects/test-project');
    mockGit.listRemotes.mockResolvedValue([
      { remote: 'origin', url: 'https://github.com/test/repo.git' }
    ]);
    mockGit.currentBranch.mockResolvedValue('main');
    mockGit.fetch.mockResolvedValue(undefined);

    // Mock resolveRef for initial fetch
    mockGit.resolveRef
      .mockResolvedValueOnce('ref: refs/remotes/origin/main')
      .mockResolvedValueOnce('abc123')
      .mockResolvedValueOnce('abc123')
      .mockResolvedValueOnce('abc123')
      .mockResolvedValueOnce('abc123');

    const { result } = renderHook(() => useGitFetch('test-project'), {
      wrapper: TestApp,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const firstFetchTime = result.current.data?.fetchedAt;

    // Setup mocks for refetch
    mockGit.resolveRef
      .mockResolvedValueOnce('ref: refs/remotes/origin/main')
      .mockResolvedValueOnce('abc123')
      .mockResolvedValueOnce('abc123')
      .mockResolvedValueOnce('abc123')
      .mockResolvedValueOnce('abc123');

    // Manually trigger refetch
    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.data?.fetchedAt).toBeGreaterThanOrEqual(firstFetchTime || 0);
    });

    // Verify fetch was called twice (initial + refetch)
    expect(mockGit.fetch).toHaveBeenCalledTimes(2);
  });

  describe('Toast Notifications', () => {
    it('shows toast when default branch changes (on default branch)', async () => {
      // Setup mocks for initial fetch (no changes)
      mockGit.findRoot.mockResolvedValue('/projects/test-project');
      mockGit.listRemotes.mockResolvedValue([
        { remote: 'origin', url: 'https://github.com/test/repo.git' }
      ]);
      mockGit.currentBranch.mockResolvedValue('main');
      mockGit.fetch.mockResolvedValue(undefined);

      // Initial fetch - no changes
      mockGit.resolveRef
        .mockResolvedValueOnce('ref: refs/remotes/origin/main')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('abc123');

      const { result } = renderHook(() => useGitFetch('test-project'), {
        wrapper: TestApp,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // No toast on initial load
      expect(mockToast).not.toHaveBeenCalled();

      // Setup for refetch with changes
      mockGit.resolveRef
        .mockResolvedValueOnce('ref: refs/remotes/origin/main')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('xyz789') // Changed!
        .mockResolvedValueOnce('xyz789');

      // Trigger refetch
      await result.current.refetch();

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledTimes(1);
      });

      // Verify toast message
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Remote changes detected',
        description: 'The main branch has new commits available.',
        variant: 'default',
      });

      // Verify git status was invalidated
      const gitStatusCalls = mockInvalidateQueries.mock.calls.filter(
        (call) => call[0]?.queryKey?.[0] === 'git-status'
      );
      expect(gitStatusCalls).toHaveLength(1);
      expect(gitStatusCalls[0][0]).toEqual({
        queryKey: ['git-status', 'test-project'],
      });
    });

    it('shows toast when non-default branch changes (on non-default branch)', async () => {
      // Setup mocks for initial fetch (no changes)
      mockGit.findRoot.mockResolvedValue('/projects/test-project');
      mockGit.listRemotes.mockResolvedValue([
        { remote: 'origin', url: 'https://github.com/test/repo.git' }
      ]);
      mockGit.currentBranch.mockResolvedValue('feature-branch');
      mockGit.fetch.mockResolvedValue(undefined);

      // Initial fetch - no changes
      mockGit.resolveRef
        .mockResolvedValueOnce('ref: refs/remotes/origin/main')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('def456')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('def456');

      const { result } = renderHook(() => useGitFetch('test-project'), {
        wrapper: TestApp,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // No toast on initial load
      expect(mockToast).not.toHaveBeenCalled();

      // Setup for refetch with changes on feature branch
      mockGit.resolveRef
        .mockResolvedValueOnce('ref: refs/remotes/origin/main')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('def456')
        .mockResolvedValueOnce('abc123') // main unchanged
        .mockResolvedValueOnce('xyz789'); // feature-branch changed!

      // Trigger refetch
      await result.current.refetch();

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledTimes(1);
      });

      // Verify toast message for feature branch
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Remote changes detected',
        description: 'The feature-branch branch has new commits available.',
        variant: 'default',
      });

      // Verify git status was invalidated
      const gitStatusCalls = mockInvalidateQueries.mock.calls.filter(
        (call) => call[0]?.queryKey?.[0] === 'git-status'
      );
      expect(gitStatusCalls).toHaveLength(1);
      expect(gitStatusCalls[0][0]).toEqual({
        queryKey: ['git-status', 'test-project'],
      });
    });

    it('shows toast when default branch changes (on non-default branch)', async () => {
      // Setup mocks for initial fetch (no changes)
      mockGit.findRoot.mockResolvedValue('/projects/test-project');
      mockGit.listRemotes.mockResolvedValue([
        { remote: 'origin', url: 'https://github.com/test/repo.git' }
      ]);
      mockGit.currentBranch.mockResolvedValue('feature-branch');
      mockGit.fetch.mockResolvedValue(undefined);

      // Initial fetch - no changes
      mockGit.resolveRef
        .mockResolvedValueOnce('ref: refs/remotes/origin/main')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('def456')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('def456');

      const { result } = renderHook(() => useGitFetch('test-project'), {
        wrapper: TestApp,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // No toast on initial load
      expect(mockToast).not.toHaveBeenCalled();

      // Setup for refetch with changes on main branch only
      mockGit.resolveRef
        .mockResolvedValueOnce('ref: refs/remotes/origin/main')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('def456')
        .mockResolvedValueOnce('xyz789') // main changed!
        .mockResolvedValueOnce('def456'); // feature-branch unchanged

      // Trigger refetch
      await result.current.refetch();

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledTimes(1);
      });

      // Verify toast message for main branch
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Remote changes detected',
        description: 'The main branch has new commits available.',
        variant: 'default',
      });

      // Verify git status was invalidated
      const gitStatusCalls = mockInvalidateQueries.mock.calls.filter(
        (call) => call[0]?.queryKey?.[0] === 'git-status'
      );
      expect(gitStatusCalls).toHaveLength(1);
      expect(gitStatusCalls[0][0]).toEqual({
        queryKey: ['git-status', 'test-project'],
      });
    });

    it('shows two toasts when both branches change (on non-default branch)', async () => {
      // Setup mocks for initial fetch (no changes)
      mockGit.findRoot.mockResolvedValue('/projects/test-project');
      mockGit.listRemotes.mockResolvedValue([
        { remote: 'origin', url: 'https://github.com/test/repo.git' }
      ]);
      mockGit.currentBranch.mockResolvedValue('feature-branch');
      mockGit.fetch.mockResolvedValue(undefined);

      // Initial fetch - no changes
      mockGit.resolveRef
        .mockResolvedValueOnce('ref: refs/remotes/origin/main')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('def456')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('def456');

      const { result } = renderHook(() => useGitFetch('test-project'), {
        wrapper: TestApp,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // No toast on initial load
      expect(mockToast).not.toHaveBeenCalled();

      // Setup for refetch with changes on both branches
      mockGit.resolveRef
        .mockResolvedValueOnce('ref: refs/remotes/origin/main')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('def456')
        .mockResolvedValueOnce('new111') // main changed!
        .mockResolvedValueOnce('new222'); // feature-branch changed!

      // Trigger refetch
      await result.current.refetch();

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledTimes(2);
      });

      // Verify both toast messages
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Remote changes detected',
        description: 'The main branch has new commits available.',
        variant: 'default',
      });
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Remote changes detected',
        description: 'The feature-branch branch has new commits available.',
        variant: 'default',
      });

      // Verify git status was invalidated twice (once per toast)
      const gitStatusCalls = mockInvalidateQueries.mock.calls.filter(
        (call) => call[0]?.queryKey?.[0] === 'git-status'
      );
      expect(gitStatusCalls).toHaveLength(2);
    });

    it('does not show toast on initial load', async () => {
      // Setup mocks
      mockGit.findRoot.mockResolvedValue('/projects/test-project');
      mockGit.listRemotes.mockResolvedValue([
        { remote: 'origin', url: 'https://github.com/test/repo.git' }
      ]);
      mockGit.currentBranch.mockResolvedValue('main');
      mockGit.fetch.mockResolvedValue(undefined);

      // Initial fetch with changes detected in the fetch itself
      mockGit.resolveRef
        .mockResolvedValueOnce('ref: refs/remotes/origin/main')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('xyz789') // Changed from before to after fetch
        .mockResolvedValueOnce('xyz789');

      const { result } = renderHook(() => useGitFetch('test-project'), {
        wrapper: TestApp,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should report changes in data
      expect(result.current.data?.hasChanges).toBe(true);

      // But no toast on initial load
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('does not show toast when no changes detected', async () => {
      // Setup mocks for initial fetch
      mockGit.findRoot.mockResolvedValue('/projects/test-project');
      mockGit.listRemotes.mockResolvedValue([
        { remote: 'origin', url: 'https://github.com/test/repo.git' }
      ]);
      mockGit.currentBranch.mockResolvedValue('main');
      mockGit.fetch.mockResolvedValue(undefined);

      // Initial fetch - no changes
      mockGit.resolveRef
        .mockResolvedValueOnce('ref: refs/remotes/origin/main')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('abc123');

      const { result } = renderHook(() => useGitFetch('test-project'), {
        wrapper: TestApp,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Setup for refetch with no changes
      mockGit.resolveRef
        .mockResolvedValueOnce('ref: refs/remotes/origin/main')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('abc123');

      // Trigger refetch
      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // No toast should be shown
      expect(mockToast).not.toHaveBeenCalled();

      // Verify git status was not invalidated (filter out other queries like 'nostr')
      const gitStatusCalls = mockInvalidateQueries.mock.calls.filter(
        (call) => call[0]?.queryKey?.[0] === 'git-status'
      );
      expect(gitStatusCalls).toHaveLength(0);
    });

    it('does not show duplicate toast for same branch when default equals current', async () => {
      // Setup mocks for initial fetch
      mockGit.findRoot.mockResolvedValue('/projects/test-project');
      mockGit.listRemotes.mockResolvedValue([
        { remote: 'origin', url: 'https://github.com/test/repo.git' }
      ]);
      mockGit.currentBranch.mockResolvedValue('main');
      mockGit.fetch.mockResolvedValue(undefined);

      // Initial fetch - no changes
      mockGit.resolveRef
        .mockResolvedValueOnce('ref: refs/remotes/origin/main')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('abc123');

      const { result } = renderHook(() => useGitFetch('test-project'), {
        wrapper: TestApp,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Setup for refetch with changes (both default and current are 'main')
      mockGit.resolveRef
        .mockResolvedValueOnce('ref: refs/remotes/origin/main')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('xyz789')
        .mockResolvedValueOnce('xyz789');

      // Trigger refetch
      await result.current.refetch();

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledTimes(1);
      });

      // Should only show one toast (for default branch), not two
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Remote changes detected',
        description: 'The main branch has new commits available.',
        variant: 'default',
      });

      // Should only invalidate once
      const gitStatusCalls = mockInvalidateQueries.mock.calls.filter(
        (call) => call[0]?.queryKey?.[0] === 'git-status'
      );
      expect(gitStatusCalls).toHaveLength(1);
    });
  });
});
