import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { GiftCardRedeemDialog } from './GiftCardRedeemDialog';

// Mock fetch
global.fetch = vi.fn();

describe('GiftCardRedeemDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    // Mock the gift card check endpoint
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() =>
      new Promise(() => {}) // Never resolves to keep it loading
    );

    render(
      <TestApp>
        <GiftCardRedeemDialog
          open={true}
          onOpenChange={() => {}}
          baseURL="https://ai.shakespeare.diy/v1"
          code="TEST-CODE-1234-5678"
        />
      </TestApp>
    );

    // Should show loading skeleton
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows error for invalid gift card', async () => {
    // Mock the gift card check endpoint to return an error
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: {
          message: 'No giftcard found with code "INVALID-CODE"',
        },
      }),
    });

    render(
      <TestApp>
        <GiftCardRedeemDialog
          open={true}
          onOpenChange={() => {}}
          baseURL="https://ai.shakespeare.diy/v1"
          code="INVALID-CODE"
        />
      </TestApp>
    );

    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByText('Invalid Gift Card')).toBeInTheDocument();
    });
  });

  it('shows already redeemed message for redeemed gift card', async () => {
    // Mock the gift card check endpoint to return a redeemed gift card
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        object: 'giftcard',
        id: 'gc_123',
        code: 'TEST-CODE-1234-5678',
        amount: 25.0,
        redeemed: true,
        created_at: 1640995200,
      }),
    });

    render(
      <TestApp>
        <GiftCardRedeemDialog
          open={true}
          onOpenChange={() => {}}
          baseURL="https://ai.shakespeare.diy/v1"
          code="TEST-CODE-1234-5678"
        />
      </TestApp>
    );

    // Wait for redeemed message to appear
    await waitFor(() => {
      expect(screen.getByText('Already Redeemed')).toBeInTheDocument();
    });
  });

  it('shows gift card amount for valid unredeemed gift card', async () => {
    // Mock the gift card check endpoint to return a valid gift card
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        object: 'giftcard',
        id: 'gc_123',
        code: 'TEST-CODE-1234-5678',
        amount: 25.0,
        redeemed: false,
        created_at: 1640995200,
      }),
    });

    render(
      <TestApp>
        <GiftCardRedeemDialog
          open={true}
          onOpenChange={() => {}}
          baseURL="https://ai.shakespeare.diy/v1"
          code="TEST-CODE-1234-5678"
        />
      </TestApp>
    );

    // Wait for gift card amount to appear
    await waitFor(() => {
      expect(screen.getByText(/You've got \$25\.00!/)).toBeInTheDocument();
    });
  });

  it('shows provider name when matching preset is found', async () => {
    // Mock the gift card check endpoint
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        object: 'giftcard',
        id: 'gc_123',
        code: 'TEST-CODE-1234-5678',
        amount: 10.0,
        redeemed: false,
        created_at: 1640995200,
      }),
    });

    render(
      <TestApp>
        <GiftCardRedeemDialog
          open={true}
          onOpenChange={() => {}}
          baseURL="https://ai.shakespeare.diy/v1"
          code="TEST-CODE-1234-5678"
        />
      </TestApp>
    );

    // Wait for provider name to appear
    await waitFor(() => {
      expect(screen.getByText('Shakespeare AI')).toBeInTheDocument();
    });
  });
});
