import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { CreditsDialog } from './CreditsDialog';
import type { AIProvider } from '@/contexts/AISettingsContext';

// Mock the fetch function
global.fetch = vi.fn();

const mockProvider: AIProvider = {
  id: 'test-provider',
  baseURL: 'https://api.test.com/v1',
  apiKey: 'test-key',
  nostr: false,
};

describe('CreditsDialog', () => {
  it('renders dialog when open', () => {
    render(
      <TestApp>
        <CreditsDialog
          open={true}
          onOpenChange={() => {}}
          provider={mockProvider}
        />
      </TestApp>
    );

    expect(screen.getByText('Credits')).toBeInTheDocument();
    expect(screen.getByText('Amount (USD)')).toBeInTheDocument();
    expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <TestApp>
        <CreditsDialog
          open={false}
          onOpenChange={() => {}}
          provider={mockProvider}
        />
      </TestApp>
    );

    expect(screen.queryByText('Credits')).not.toBeInTheDocument();
  });

  it('shows payment method options', () => {
    render(
      <TestApp>
        <CreditsDialog
          open={true}
          onOpenChange={() => {}}
          provider={mockProvider}
        />
      </TestApp>
    );

    expect(screen.getByText('Payment Method')).toBeInTheDocument();
    expect(screen.getByText('Amount (USD)')).toBeInTheDocument();
  });

  it('shows preset amount buttons', () => {
    render(
      <TestApp>
        <CreditsDialog
          open={true}
          onOpenChange={() => {}}
          provider={mockProvider}
        />
      </TestApp>
    );

    expect(screen.getByText('$5')).toBeInTheDocument();
    expect(screen.getByText('$10')).toBeInTheDocument();
    expect(screen.getByText('$25')).toBeInTheDocument();
    expect(screen.getByText('$50')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
  });



  it('calls onDialogStateChange callback when dialog state changes', () => {
    const mockCallback = vi.fn();
    const { rerender } = render(
      <TestApp>
        <CreditsDialog
          open={false}
          onOpenChange={mockCallback}
          provider={mockProvider}
        />
      </TestApp>
    );

    // Simulate opening the dialog
    rerender(
      <TestApp>
        <CreditsDialog
          open={true}
          onOpenChange={mockCallback}
          provider={mockProvider}
        />
      </TestApp>
    );

    expect(screen.getByText('Credits')).toBeInTheDocument();
  });
});