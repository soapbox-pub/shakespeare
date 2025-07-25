import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { GitCommit } from './GitCommit';

describe('GitCommit', () => {
  it('renders commit message and shows committing state', () => {
    render(
      <TestApp>
        <GitCommit message="feat: add new feature" />
      </TestApp>
    );

    expect(screen.getByText('feat: add new feature')).toBeInTheDocument();
    expect(screen.getByText('Committing')).toBeInTheDocument();
    expect(screen.getByText('Git commit')).toBeInTheDocument();
  });

  it('shows success state with commit details', () => {
    const result = `✅ Successfully committed 3 files (abc1234)

📝 Commit: "feat: add new feature"
🔗 Hash: abc1234
🌿 Branch: main
📊 Changes:
  • 2 files added
  • 1 file modified`;

    render(
      <TestApp>
        <GitCommit
          message="feat: add new feature"
          result={result}
          isError={false}
        />
      </TestApp>
    );

    expect(screen.getByText('Committed')).toBeInTheDocument();
    expect(screen.getByText('Successfully committed 3 files')).toBeInTheDocument();
    expect(screen.getByText('abc1234')).toBeInTheDocument();
    expect(screen.getByText('2 added')).toBeInTheDocument();
    expect(screen.getByText('1 modified')).toBeInTheDocument();
  });

  it('shows error state', () => {
    render(
      <TestApp>
        <GitCommit
          message="fix: broken feature"
          result="❌ Error committing changes: Not a git repository"
          isError={true}
        />
      </TestApp>
    );

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('fix: broken feature')).toBeInTheDocument();
  });

  it('shows only first line of multi-line commit messages and provides expandable full message', () => {
    const multiLineMessage = "feat: add new feature\n\nThis is a detailed description\nof the new feature implementation";

    render(
      <TestApp>
        <GitCommit message={multiLineMessage} />
      </TestApp>
    );

    expect(screen.getByText('feat: add new feature')).toBeInTheDocument();
    expect(screen.queryByText('This is a detailed description')).not.toBeInTheDocument();
    expect(screen.getByText('View full commit message')).toBeInTheDocument();
  });

  it('does not show expandable section for single-line commit messages', () => {
    const singleLineMessage = "feat: add new feature";

    render(
      <TestApp>
        <GitCommit message={singleLineMessage} />
      </TestApp>
    );

    expect(screen.getByText('feat: add new feature')).toBeInTheDocument();
    expect(screen.queryByText('View full commit message')).not.toBeInTheDocument();
  });

  it('shows appropriate emoji for different commit types', () => {
    const { rerender } = render(
      <TestApp>
        <GitCommit message="feat: new feature" />
      </TestApp>
    );

    expect(screen.getByText('✨')).toBeInTheDocument();

    rerender(
      <TestApp>
        <GitCommit message="fix: bug fix" />
      </TestApp>
    );

    expect(screen.getByText('🐛')).toBeInTheDocument();

    rerender(
      <TestApp>
        <GitCommit message="docs: update documentation" />
      </TestApp>
    );

    expect(screen.getByText('📚')).toBeInTheDocument();
  });
});