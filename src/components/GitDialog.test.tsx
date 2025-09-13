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

vi.mock('@/hooks/useGitSettings', () => ({
  useGitSettings: vi.fn(() => ({
    settings: {
      credentials: {
        'https://github.com': {
          username: 'git',
          password: 'github-token',
        },
      },
    },
  })),
}));

describe('GitDialog', () => {
  beforeEach(() => {
    mockUseGitStatus.mockReturnValue({
      data: baseGitStatus,
      refetch: mockRefetch,
    });
  });

  it('renders git repository information', () => {
    render(
      <TestApp>
        <GitDialog projectId="test-project" open={true} onOpenChange={() => {}}>
          <button>Open Git Dialog</button>
        </GitDialog>
      </TestApp>
    );

    expect(screen.getByText('Git Repository Status')).toBeInTheDocument();
    expect(screen.getByText('Repository Information')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getAllByText('origin')).toHaveLength(2); // Appears in remotes and credentials sections
  });

  it('shows sync status', () => {
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

  it('disables push button when no commits ahead', () => {
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

  it('shows configured credentials status', () => {
    render(
      <TestApp>
        <GitDialog projectId="test-project" open={true} onOpenChange={() => {}}>
          <button>Open Git Dialog</button>
        </GitDialog>
      </TestApp>
    );

    expect(screen.getByText('Authentication')).toBeInTheDocument();
    expect(screen.getByText('github.com')).toBeInTheDocument();
    expect(screen.getByText('Configured')).toBeInTheDocument();
  });
});