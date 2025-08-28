import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { GitStatusIndicator } from './GitStatusIndicator';

// Mock the useGitStatus hook
vi.mock('@/hooks/useGitStatus', () => ({
  useGitStatus: vi.fn(),
}));

import { useGitStatus } from '@/hooks/useGitStatus';

describe('GitStatusIndicator', () => {
  it('should not render when not in a git repo', () => {
    vi.mocked(useGitStatus).mockReturnValue({
      data: {
        hasUncommittedChanges: false,
        changedFiles: [],
        isGitRepo: false,
      },
    } as unknown as ReturnType<typeof useGitStatus>);

    const { container } = render(
      <TestApp>
        <GitStatusIndicator projectId="test-project" />
      </TestApp>
    );

    expect(container.firstChild).toBeNull();
  });

  it('should not render when no uncommitted changes', () => {
    vi.mocked(useGitStatus).mockReturnValue({
      data: {
        hasUncommittedChanges: false,
        changedFiles: [],
        isGitRepo: true,
      },
    } as unknown as ReturnType<typeof useGitStatus>);

    const { container } = render(
      <TestApp>
        <GitStatusIndicator projectId="test-project" />
      </TestApp>
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render yellow dot when there are uncommitted changes', () => {
    vi.mocked(useGitStatus).mockReturnValue({
      data: {
        hasUncommittedChanges: true,
        changedFiles: ['file1.txt', 'file2.txt'],
        isGitRepo: true,
      },
    } as unknown as ReturnType<typeof useGitStatus>);

    const { container } = render(
      <TestApp>
        <GitStatusIndicator projectId="test-project" />
      </TestApp>
    );

    const indicator = container.firstChild as HTMLElement;
    expect(indicator).toBeTruthy();
    expect(indicator.className).toContain('bg-yellow-500');
    expect(indicator.className).toContain('rounded-full');
    expect(indicator.title).toBe('2 uncommitted changes');
  });

  it('should handle singular file count in tooltip', () => {
    vi.mocked(useGitStatus).mockReturnValue({
      data: {
        hasUncommittedChanges: true,
        changedFiles: ['file1.txt'],
        isGitRepo: true,
      },
    } as unknown as ReturnType<typeof useGitStatus>);

    const { container } = render(
      <TestApp>
        <GitStatusIndicator projectId="test-project" />
      </TestApp>
    );

    const indicator = container.firstChild as HTMLElement;
    expect(indicator.title).toBe('1 uncommitted change');
  });
});