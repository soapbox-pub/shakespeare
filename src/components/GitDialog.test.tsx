import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { GitDialog } from './GitDialog';

// Mock the hooks
const mockRefetch = vi.fn();
const mockUseGitStatus = vi.fn();

const baseGitStatus = {
  isGitRepo: true,
  currentBranch: 'main',
  hasUncommittedChanges: false,
  changedFiles: [],
  totalCommits: 5,
  remotes: [{ name: 'origin', url: 'https://github.com/example/repo.git' }],
  latestCommit: {
    oid: 'abc123def456',
    message: 'Initial commit',
    author: {
      name: 'Test User',
      email: 'test@example.com',
      timestamp: Date.now() / 1000,
    },
  },
  ahead: 0,
  behind: 0,
  remoteBranchExists: false,
};

vi.mock('@/hooks/useGitStatus', () => ({
  useGitStatus: () => mockUseGitStatus(),
}));

vi.mock('@/hooks/useFS', () => ({
  useFS: vi.fn(() => ({
    fs: {},
  })),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

const mockUseGitSettings = vi.fn();

vi.mock('@/hooks/useGitSettings', () => ({
  useGitSettings: () => mockUseGitSettings(),
}));

describe('GitDialog', () => {
  beforeEach(() => {
    mockUseGitStatus.mockReturnValue({
      data: baseGitStatus,
      refetch: mockRefetch,
    });

    mockUseGitSettings.mockReturnValue({
      settings: {
        credentials: [
          {
            id: crypto.randomUUID(),
            name: 'GitHub',
            origin: 'https://github.com',
            username: 'git',
            password: 'github-token',
          },
        ],
      },
    });
  });

  it('renders git dialog without repository information section', () => {
    render(
      <TestApp>
        <GitDialog projectId="test-project" open={true} onOpenChange={() => {}}>
          <button>Open Git Dialog</button>
        </GitDialog>
      </TestApp>
    );

    expect(screen.getByText('Repository')).toBeInTheDocument();
    expect(screen.queryByText('Repository Information')).not.toBeInTheDocument();
    expect(screen.queryByText('Authentication')).not.toBeInTheDocument(); // Authentication section is removed
  });

  it('shows sync status when branch is published', () => {
    // Mock git status with published branch
    mockUseGitStatus.mockReturnValue({
      data: {
        ...baseGitStatus,
        remoteBranchExists: true,
      },
      refetch: mockRefetch,
    });

    render(
      <TestApp>
        <GitDialog projectId="test-project" open={true} onOpenChange={() => {}}>
          <button>Open Git Dialog</button>
        </GitDialog>
      </TestApp>
    );

    expect(screen.getByText('Sync Status')).toBeInTheDocument();
    expect(screen.getByText('Up to date')).toBeInTheDocument();
    expect(screen.getByText('Pull')).toBeInTheDocument();
    expect(screen.getByText('Push')).toBeInTheDocument();
  });

  it('shows clean working directory when no changes', () => {
    render(
      <TestApp>
        <GitDialog projectId="test-project" open={true} onOpenChange={() => {}}>
          <button>Open Git Dialog</button>
        </GitDialog>
      </TestApp>
    );

    expect(screen.getByText('Working directory is clean')).toBeInTheDocument();
    expect(screen.getByText('No uncommitted changes')).toBeInTheDocument();
  });

  it('enables push button when there are commits ahead', () => {
    // Mock git status with commits ahead
    mockUseGitStatus.mockReturnValue({
      data: {
        ...baseGitStatus,
        ahead: 2,
      },
      refetch: mockRefetch,
    });

    render(
      <TestApp>
        <GitDialog projectId="test-project" open={true} onOpenChange={() => {}}>
          <button>Open Git Dialog</button>
        </GitDialog>
      </TestApp>
    );

    const pushButton = screen.getByText('Push');
    expect(pushButton).toBeInTheDocument();
    expect(pushButton.closest('button')).not.toBeDisabled();
  });

  it('disables push button when no commits ahead and branch is published', () => {
    // Mock git status with published branch and no commits ahead
    mockUseGitStatus.mockReturnValue({
      data: {
        ...baseGitStatus,
        ahead: 0,
        remoteBranchExists: true,
      },
      refetch: mockRefetch,
    });

    render(
      <TestApp>
        <GitDialog projectId="test-project" open={true} onOpenChange={() => {}}>
          <button>Open Git Dialog</button>
        </GitDialog>
      </TestApp>
    );

    const pushButton = screen.getByText('Push');
    expect(pushButton).toBeInTheDocument();
    expect(pushButton.closest('button')).toBeDisabled();
  });

  it('enables push and disables pull when branch is not published', () => {
    // Mock git status with unpublished branch (has commits but no remote branch)
    mockUseGitStatus.mockReturnValue({
      data: {
        ...baseGitStatus,
        ahead: 0,
        remoteBranchExists: false,
        totalCommits: 5,
      },
      refetch: mockRefetch,
    });

    render(
      <TestApp>
        <GitDialog projectId="test-project" open={true} onOpenChange={() => {}}>
          <button>Open Git Dialog</button>
        </GitDialog>
      </TestApp>
    );

    expect(screen.getByText('Sync Status')).toBeInTheDocument();
    expect(screen.getByText('Branch not published')).toBeInTheDocument();

    const pushButton = screen.getByText('Push');
    expect(pushButton).toBeInTheDocument();
    expect(pushButton.closest('button')).not.toBeDisabled();

    const pullButton = screen.getByText('Pull');
    expect(pullButton).toBeInTheDocument();
    expect(pullButton.closest('button')).toBeDisabled();
  });

  it('does not show credentials warning when credentials are configured', () => {
    render(
      <TestApp>
        <GitDialog projectId="test-project" open={true} onOpenChange={() => {}}>
          <button>Open Git Dialog</button>
        </GitDialog>
      </TestApp>
    );

    // Should not show warning when credentials are configured
    expect(screen.queryByText(/No credentials configured/)).not.toBeInTheDocument();
    expect(screen.queryByText('Authentication')).not.toBeInTheDocument(); // Authentication section is removed
  });

  it('shows credentials warning when no credentials are configured', () => {
    // Mock git settings with no credentials and mock git status with an https remote
    mockUseGitSettings.mockReturnValue({
      settings: {
        credentials: [],
      },
    });

    mockUseGitStatus.mockReturnValue({
      data: {
        ...baseGitStatus,
        remotes: [{ name: 'origin', url: 'https://github.com/example/repo.git' }],
      },
      refetch: mockRefetch,
    });

    render(
      <TestApp>
        <GitDialog projectId="test-project" open={true} onOpenChange={() => {}}>
          <button>Open Git Dialog</button>
        </GitDialog>
      </TestApp>
    );

    // Should show warning when credentials are missing
    expect(screen.getByText(/You are not logged into github.com/)).toBeInTheDocument();
    expect(screen.getByText('log in')).toBeInTheDocument();
    expect(screen.queryByText('Authentication')).not.toBeInTheDocument(); // Authentication section is removed
  });
});