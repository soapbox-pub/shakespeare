import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { GitHistoryDialog } from './GitHistoryDialog';

// Mock the useGit hook
const mockGit = {
  log: vi.fn(),
  resolveRef: vi.fn(),
  readCommit: vi.fn(),
  listFiles: vi.fn(),
  readBlob: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  commit: vi.fn(),
  findRoot: vi.fn(),
};

vi.mock('@/hooks/useGit', () => ({
  useGit: () => mockGit,
}));
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

    mockGit.findRoot.mockResolvedValue('/projects/test-project/.git');
    mockGit.log.mockResolvedValue(mockCommits);

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

  it('handles multi-line commit messages with expand/collapse', async () => {
    const mockCommits = [
      {
        oid: 'commit1',
        commit: {
          message: 'Add new feature\n\nThis commit adds a new feature with the following changes:\n- Added component A\n- Updated component B\n- Fixed bug in component C',
          author: { name: 'User', email: 'user@example.com', timestamp: Math.floor(Date.now() / 1000), timezoneOffset: 0 },
          committer: { name: 'User', email: 'user@example.com', timestamp: Math.floor(Date.now() / 1000), timezoneOffset: 0 },
          parent: [],
          tree: 'tree1',
        },
        payload: '',
      },
    ];

    mockGit.findRoot.mockResolvedValue('/projects/test-project/.git');
    mockGit.log.mockResolvedValue(mockCommits);

    render(
      <TestApp>
        <GitHistoryDialog projectId="test-project" />
      </TestApp>
    );

    const historyButton = screen.getByRole('button', { name: /history/i });
    fireEvent.click(historyButton);

    await waitFor(() => {
      expect(screen.getByText('Add new feature')).toBeInTheDocument();
    });

    // Should show expand button for multi-line commit
    const expandButton = screen.getByRole('button', { name: '' }); // ChevronDown button
    expect(expandButton).toBeInTheDocument();

    // Click to expand
    fireEvent.click(expandButton);

    // Should show the expanded content
    await waitFor(() => {
      expect(screen.getByText(/This commit adds a new feature/)).toBeInTheDocument();
    });
  });
});