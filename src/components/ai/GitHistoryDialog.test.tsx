import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { GitHistoryDialog } from './GitHistoryDialog';

// Mock isomorphic-git
vi.mock('isomorphic-git', () => ({
  default: {
    log: vi.fn(),
    resolveRef: vi.fn(),
    readCommit: vi.fn(),
    listFiles: vi.fn(),
    readBlob: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    commit: vi.fn(),
  },
}));

// Mock the useFS hook
vi.mock('@/hooks/useFS', () => ({
  useFS: () => ({
    fs: {
      stat: vi.fn(),
      unlink: vi.fn(),
      mkdir: vi.fn(),
      writeFile: vi.fn(),
    },
  }),
}));

// Mock the useToast hook
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('GitHistoryDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the history button', () => {
    render(
      <TestApp>
        <GitHistoryDialog projectId="test-project" />
      </TestApp>
    );

    expect(screen.getByRole('button', { name: /history/i })).toBeInTheDocument();
  });

  it('opens dialog when history button is clicked', async () => {
    render(
      <TestApp>
        <GitHistoryDialog projectId="test-project" />
      </TestApp>
    );

    const historyButton = screen.getByRole('button', { name: /history/i });
    fireEvent.click(historyButton);

    await waitFor(() => {
      expect(screen.getByText('Git History')).toBeInTheDocument();
    });
  });

  it('shows loading state when dialog opens', async () => {
    render(
      <TestApp>
        <GitHistoryDialog projectId="test-project" />
      </TestApp>
    );

    const historyButton = screen.getByRole('button', { name: /history/i });
    fireEvent.click(historyButton);

    await waitFor(() => {
      expect(screen.getByText('Loading git history...')).toBeInTheDocument();
    });
  });

  it('renders rollback buttons for commits (except the first one)', async () => {
    const mockCommits = [
      {
        oid: 'commit1',
        commit: {
          message: 'Latest commit',
          author: { name: 'User', email: 'user@example.com', timestamp: Math.floor(Date.now() / 1000), timezoneOffset: 0 },
          committer: { name: 'User', email: 'user@example.com', timestamp: Math.floor(Date.now() / 1000), timezoneOffset: 0 },
          parent: [],
          tree: 'tree1',
        },
        payload: '',
      },
      {
        oid: 'commit2',
        commit: {
          message: 'Previous commit',
          author: { name: 'User', email: 'user@example.com', timestamp: Math.floor(Date.now() / 1000) - 3600, timezoneOffset: 0 },
          committer: { name: 'User', email: 'user@example.com', timestamp: Math.floor(Date.now() / 1000) - 3600, timezoneOffset: 0 },
          parent: [],
          tree: 'tree2',
        },
        payload: '',
      },
    ];

    const git = await import('isomorphic-git');
    vi.mocked(git.default.log).mockResolvedValue(mockCommits);

    render(
      <TestApp>
        <GitHistoryDialog projectId="test-project" />
      </TestApp>
    );

    const historyButton = screen.getByRole('button', { name: /history/i });
    fireEvent.click(historyButton);

    await waitFor(() => {
      expect(screen.getByText('Latest commit')).toBeInTheDocument();
      expect(screen.getByText('Previous commit')).toBeInTheDocument();
    });

    // Should have one rollback button (not for the latest commit)
    const rollbackButtons = screen.getAllByText('Rollback');
    expect(rollbackButtons).toHaveLength(1);
  });
});