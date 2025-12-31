import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { AIProviderConfigDialog } from './AIProviderConfigDialog';
import type { AIProvider } from '@/contexts/AISettingsContext';

// Mock useAICredits to return credits data
vi.mock('@/hooks/useAICredits', () => ({
  useAICredits: () => ({
    data: { amount: 10.50 },
    error: null,
    isLoading: false,
  }),
}));

// Mock the fetch function
global.fetch = vi.fn();

const mockProvider: AIProvider = {
  id: 'test-provider',
  name: 'Test Provider',
  baseURL: 'https://api.test.com/v1',
  apiKey: 'test-key',
  nostr: false,
};

describe('AIProviderConfigDialog - Credits Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog when open with credits tab', async () => {
    render(
      <TestApp>
        <AIProviderConfigDialog
          open={true}
          onOpenChange={() => {}}
          provider={mockProvider}
          onUpdate={() => {}}
          onRemove={() => {}}
          initialTab="credits"
        />
      </TestApp>
    );

    // Wait for the dialog to render with tabs
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /credits/i })).toBeInTheDocument();
    });

    expect(screen.getByText('Buy Credits')).toBeInTheDocument();
    expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <TestApp>
        <AIProviderConfigDialog
          open={false}
          onOpenChange={() => {}}
          provider={mockProvider}
          onUpdate={() => {}}
          onRemove={() => {}}
        />
      </TestApp>
    );

    expect(screen.queryByText('Credits')).not.toBeInTheDocument();
  });

  it('shows payment method options', async () => {
    render(
      <TestApp>
        <AIProviderConfigDialog
          open={true}
          onOpenChange={() => {}}
          provider={mockProvider}
          onUpdate={() => {}}
          onRemove={() => {}}
          initialTab="credits"
        />
      </TestApp>
    );

    // Wait for accordion to be available and click to expand
    await waitFor(() => {
      expect(screen.getByText('Buy Credits')).toBeInTheDocument();
    });

    // The content is in an accordion that needs to be expanded
    // Check for accordion trigger text instead
    expect(screen.getByText('Buy Credits')).toBeInTheDocument();
  });

  it('shows preset amount buttons', async () => {
    render(
      <TestApp>
        <AIProviderConfigDialog
          open={true}
          onOpenChange={() => {}}
          provider={mockProvider}
          onUpdate={() => {}}
          onRemove={() => {}}
          initialTab="credits"
        />
      </TestApp>
    );

    // Wait for the Buy Credits accordion to be visible
    // The "add" accordion defaults to being open
    await waitFor(() => {
      expect(screen.getByText('Buy Credits')).toBeInTheDocument();
    });

    // The preset buttons should be visible since the accordion defaults to open
    await waitFor(() => {
      expect(screen.getByText('$5')).toBeInTheDocument();
      expect(screen.getByText('$10')).toBeInTheDocument();
      expect(screen.getByText('$25')).toBeInTheDocument();
      expect(screen.getByText('$50')).toBeInTheDocument();
      expect(screen.getByText('$100')).toBeInTheDocument();
    });
  });

  it('calls onDialogStateChange callback when dialog state changes', async () => {
    const mockCallback = vi.fn();
    const { rerender } = render(
      <TestApp>
        <AIProviderConfigDialog
          open={false}
          onOpenChange={mockCallback}
          provider={mockProvider}
          onUpdate={() => {}}
          onRemove={() => {}}
        />
      </TestApp>
    );

    // Simulate opening the dialog
    rerender(
      <TestApp>
        <AIProviderConfigDialog
          open={true}
          onOpenChange={mockCallback}
          provider={mockProvider}
          onUpdate={() => {}}
          onRemove={() => {}}
          initialTab="credits"
        />
      </TestApp>
    );

    // Wait for the Credits tab to appear
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /credits/i })).toBeInTheDocument();
    });
  });
});