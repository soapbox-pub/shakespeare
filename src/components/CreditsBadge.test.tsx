import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { CreditsBadge } from './CreditsBadge';

// Mock the useAICredits hook
vi.mock('@/hooks/useAICredits', () => ({
  useAICredits: () => ({
    data: { amount: 10.50 },
    isLoading: false,
    error: null,
  }),
}));

// Mock the fetch function
global.fetch = vi.fn();

const mockProvider = {
  id: 'test-provider',
  name: 'Test Provider',
  baseURL: 'https://api.test.com/v1',
  apiKey: 'test-key',
};

describe('CreditsBadge', () => {
  it('renders the credits amount', () => {
    render(
      <TestApp>
        <CreditsBadge provider={mockProvider} />
      </TestApp>
    );

    expect(screen.getByText('$10.50')).toBeInTheDocument();
  });

  it('calls onOpenDialog when badge is clicked', () => {
    const mockCallback = vi.fn();

    render(
      <TestApp>
        <CreditsBadge
          provider={mockProvider}
          onOpenDialog={mockCallback}
        />
      </TestApp>
    );

    const badge = screen.getByText('$10.50');
    fireEvent.click(badge);

    expect(mockCallback).toHaveBeenCalled();
  });

  it('has proper styling for clickable badge', () => {
    render(
      <TestApp>
        <CreditsBadge provider={mockProvider} />
      </TestApp>
    );

    const badge = screen.getByText('$10.50');
    expect(badge).toHaveClass('cursor-pointer');
    expect(badge).toHaveClass('hover:bg-secondary/80');
  });

  it('does not render dialog directly', () => {
    render(
      <TestApp>
        <CreditsBadge provider={mockProvider} />
      </TestApp>
    );

    // Dialog should not be rendered by CreditsBadge itself
    expect(screen.queryByText('Credits - test-provider')).not.toBeInTheDocument();
  });
});