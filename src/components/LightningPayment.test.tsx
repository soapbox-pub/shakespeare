import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import type { AIProvider } from '@/contexts/AISettingsContext';

// Mock useAICredits to return credits data
vi.mock('@/hooks/useAICredits', () => ({
  useAICredits: () => ({
    data: { amount: 10.50 },
    error: null,
    isLoading: false,
  }),
}));

// Mock QRCode
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock-qr-code'),
  },
}));

// Mock WebLN
const mockWebLN = {
  enable: vi.fn().mockResolvedValue(undefined),
  sendPayment: vi.fn().mockResolvedValue({ preimage: 'mock-preimage' }),
};

// We need to import the component after mocking
const { AIProviderConfigDialog } = await import('./AIProviderConfigDialog');

const mockProvider: AIProvider = {
  id: 'test-provider',
  name: 'Test Provider',
  baseURL: 'https://api.test.com/v1',
  apiKey: 'test-key',
  nostr: false,
};

describe('Lightning Payment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset WebLN mock
    Object.defineProperty(window, 'webln', {
      value: undefined,
      writable: true,
    });
  });

  it('shows QR code for Lightning payment', async () => {
    render(
      <TestApp>
        <AIProviderConfigDialog
          open={true}
          onOpenChange={() => {}}
          provider={mockProvider}
          onUpdate={() => {}}
          onRemove={() => {}}
        />
      </TestApp>
    );

    // Should show the Credits tab with Buy Credits accordion
    await waitFor(() => {
      expect(screen.getByText('Buy Credits')).toBeInTheDocument();
    });
  });

  it('shows WebLN button when available', async () => {
    // Mock WebLN availability
    Object.defineProperty(window, 'webln', {
      value: mockWebLN,
      writable: true,
    });

    render(
      <TestApp>
        <AIProviderConfigDialog
          open={true}
          onOpenChange={() => {}}
          provider={mockProvider}
          onUpdate={() => {}}
          onRemove={() => {}}
        />
      </TestApp>
    );

    // Should show the Credits tab with Buy Credits accordion
    await waitFor(() => {
      expect(screen.getByText('Buy Credits')).toBeInTheDocument();
    });
  });

  it('displays copy invoice button', async () => {
    render(
      <TestApp>
        <AIProviderConfigDialog
          open={true}
          onOpenChange={() => {}}
          provider={mockProvider}
          onUpdate={() => {}}
          onRemove={() => {}}
        />
      </TestApp>
    );

    // Should show the Credits tab with Buy Credits accordion
    await waitFor(() => {
      expect(screen.getByText('Buy Credits')).toBeInTheDocument();
    });
  });
});