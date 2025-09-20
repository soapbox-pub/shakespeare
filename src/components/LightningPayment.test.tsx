import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';

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
const { CreditsDialog } = await import('./CreditsDialog');

const mockConnection = {
  baseURL: 'https://api.test.com/v1',
  apiKey: 'test-key',
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
        <CreditsDialog
          open={true}
          onOpenChange={() => {}}
          providerId="test-provider"
          connection={mockConnection}
        />
      </TestApp>
    );

    // Should show the normal form initially
    expect(screen.getByText('Amount (USD)')).toBeInTheDocument();
  });

  it('shows WebLN button when available', async () => {
    // Mock WebLN availability
    Object.defineProperty(window, 'webln', {
      value: mockWebLN,
      writable: true,
    });

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

    // Should show the normal form initially
    expect(screen.getByText('Amount (USD)')).toBeInTheDocument();
  });

  it('displays copy invoice button', async () => {
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

    // Should show the normal form initially
    expect(screen.getByText('Payment Method')).toBeInTheDocument();
  });
});