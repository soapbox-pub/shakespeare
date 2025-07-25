import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { GitHistoryDialog } from './GitHistoryDialog';

// Mock isomorphic-git
vi.mock('isomorphic-git', () => ({
  default: {
    log: vi.fn(),
  },
}));

// Mock the useFS hook
vi.mock('@/hooks/useFS', () => ({
  useFS: () => ({
    fs: {
      stat: vi.fn(),
    },
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
});