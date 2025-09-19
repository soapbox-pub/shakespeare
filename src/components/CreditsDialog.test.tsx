import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { CreditsDialog } from './CreditsDialog';
import type { AIConnection } from '@/contexts/AISettingsContext';

// Mock the fetch function
global.fetch = vi.fn();

const mockConnection: AIConnection = {
  baseURL: 'https://api.test.com/v1',
  apiKey: 'test-key',
};

describe('CreditsDialog', () => {
  it('renders dialog when open', () => {
    render(
      <TestApp>
        <CreditsDialog
          open={true}
          onOpenChange={() => {}}
          providerId="test-provider"
          connection={mockConnection}
        />
      </TestApp>
    );

    expect(screen.getByText('Credits - test-provider')).toBeInTheDocument();
    expect(screen.getByText('Add Credits')).toBeInTheDocument();
    expect(screen.getByText('Transaction History')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <TestApp>
        <CreditsDialog
          open={false}
          onOpenChange={() => {}}
          providerId="test-provider"
          connection={mockConnection}
        />
      </TestApp>
    );

    expect(screen.queryByText('Credits - test-provider')).not.toBeInTheDocument();
  });

  it('shows payment method options', () => {
    render(
      <TestApp>
        <CreditsDialog
          open={true}
          onOpenChange={() => {}}
          providerId="test-provider"
          connection={mockConnection}
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
          providerId="test-provider"
          connection={mockConnection}
        />
      </TestApp>
    );

    expect(screen.getByText('$5')).toBeInTheDocument();
    expect(screen.getByText('$10')).toBeInTheDocument();
    expect(screen.getByText('$25')).toBeInTheDocument();
    expect(screen.getByText('$50')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
  });

  it('shows login requirement when user is not logged in', () => {
    render(
      <TestApp>
        <CreditsDialog
          open={true}
          onOpenChange={() => {}}
          providerId="test-provider"
          connection={mockConnection}
        />
      </TestApp>
    );

    expect(screen.getByText('Please log in to purchase credits')).toBeInTheDocument();
  });

  it('calls onDialogStateChange callback when dialog state changes', () => {
    const mockCallback = vi.fn();
    const { rerender } = render(
      <TestApp>
        <CreditsDialog
          open={false}
          onOpenChange={mockCallback}
          providerId="test-provider"
          connection={mockConnection}
        />
      </TestApp>
    );

    // Simulate opening the dialog
    rerender(
      <TestApp>
        <CreditsDialog
          open={true}
          onOpenChange={mockCallback}
          providerId="test-provider"
          connection={mockConnection}
        />
      </TestApp>
    );

    expect(screen.getByText('Credits - test-provider')).toBeInTheDocument();
  });
});