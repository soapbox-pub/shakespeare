import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BranchSwitcher } from './BranchSwitcher';
import { TestApp } from '@/test/TestApp';

// Mock hooks
vi.mock('@/hooks/useGitStatus', () => ({
  useGitStatus: vi.fn(),
}));

vi.mock('@/hooks/useGit', () => ({
  useGit: vi.fn(),
}));

vi.mock('@/hooks/useFSPaths', () => ({
  useFSPaths: vi.fn(() => ({
    projectsPath: '/projects',
  })),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

import { useGitStatus } from '@/hooks/useGitStatus';
import { useGit } from '@/hooks/useGit';

describe('BranchSwitcher', () => {
  const mockGit = {
    checkout: vi.fn(),
    branch: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useGit as ReturnType<typeof vi.fn>).mockReturnValue({ git: mockGit });
  });

  it('should not render when not in a git repository', () => {
    (useGitStatus as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        isGitRepo: false,
        currentBranch: null,
        branches: [],
      },
    });

    const { container } = render(
      <TestApp>
        <BranchSwitcher projectId="test-project" />
      </TestApp>
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render branch switcher button when in a git repository', () => {
    (useGitStatus as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        isGitRepo: true,
        currentBranch: 'main',
        branches: ['main', 'develop'],
        hasUncommittedChanges: false,
      },
    });

    render(
      <TestApp>
        <BranchSwitcher projectId="test-project" />
      </TestApp>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
  });

  it('should show dropdown menu when clicked', async () => {
    const user = userEvent.setup();
    (useGitStatus as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        isGitRepo: true,
        currentBranch: 'main',
        branches: ['main', 'develop', 'feature/test'],
        hasUncommittedChanges: false,
      },
    });

    render(
      <TestApp>
        <BranchSwitcher projectId="test-project" />
      </TestApp>
    );

    const button = screen.getByRole('button');
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText('Switch Branch')).toBeInTheDocument();
      expect(screen.getByText('develop')).toBeInTheDocument();
      expect(screen.getByText('feature/test')).toBeInTheDocument();
      expect(screen.getByText('Create new branch')).toBeInTheDocument();
    });
  });

  it('should show current branch with checkmark', async () => {
    const user = userEvent.setup();
    (useGitStatus as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        isGitRepo: true,
        currentBranch: 'main',
        branches: ['main', 'develop'],
        hasUncommittedChanges: false,
      },
    });

    render(
      <TestApp>
        <BranchSwitcher projectId="test-project" />
      </TestApp>
    );

    const button = screen.getByRole('button');
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText('Switch Branch')).toBeInTheDocument();
      expect(screen.getByText('develop')).toBeInTheDocument();
    });
  });

  it('should open create branch dialog when clicking create new branch', async () => {
    const user = userEvent.setup();
    (useGitStatus as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        isGitRepo: true,
        currentBranch: 'main',
        branches: ['main'],
        hasUncommittedChanges: false,
      },
    });

    render(
      <TestApp>
        <BranchSwitcher projectId="test-project" />
      </TestApp>
    );

    const button = screen.getByRole('button');
    await user.click(button);

    const createButton = await screen.findByText('Create new branch');
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create New Branch')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('feature/my-new-feature')).toBeInTheDocument();
    });
  });

  it('should handle branch creation', async () => {
    const user = userEvent.setup();
    (useGitStatus as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        isGitRepo: true,
        currentBranch: 'main',
        branches: ['main'],
        hasUncommittedChanges: false,
      },
    });

    mockGit.branch.mockResolvedValue(undefined);
    mockGit.checkout.mockResolvedValue(undefined);

    render(
      <TestApp>
        <BranchSwitcher projectId="test-project" />
      </TestApp>
    );

    // Open dropdown
    const button = screen.getByRole('button');
    await user.click(button);

    // Click create new branch
    const createButton = await screen.findByText('Create new branch');
    await user.click(createButton);

    // Enter branch name
    const input = await screen.findByPlaceholderText('feature/my-new-feature');
    await user.type(input, 'feature/new-branch');

    // Click create button
    const createBranchButton = screen.getByRole('button', { name: /Create Branch/i });
    await user.click(createBranchButton);

    await waitFor(() => {
      expect(mockGit.branch).toHaveBeenCalledWith({
        dir: '/projects/test-project',
        ref: 'feature/new-branch',
      });
      expect(mockGit.checkout).toHaveBeenCalledWith({
        dir: '/projects/test-project',
        ref: 'feature/new-branch',
      });
    });
  });
});
