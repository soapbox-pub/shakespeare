import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import Index from './Index';

// Mock fetch
global.fetch = vi.fn();

// Mock useLocation and useNavigate
const mockNavigate = vi.fn();
const mockLocation = { pathname: '/', hash: '', search: '', state: null, key: 'default' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  };
});

describe('Index - Gift Card URL Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockLocation.pathname = '/';
    mockLocation.hash = '';
  });

  it('opens gift card dialog when navigating to /giftcard with hash parameters', async () => {
    // Mock the gift card check endpoint
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

    // Set location to /giftcard with hash
    mockLocation.pathname = '/giftcard';
    mockLocation.hash = '#baseURL=https://ai.shakespeare.diy/v1&code=TEST-CODE-1234-5678';

    render(
      <TestApp>
        <Index />
      </TestApp>
    );

    // Wait for gift card dialog to appear
    await waitFor(() => {
      expect(screen.getByText(/You've got \$25\.00!/)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify URL was rewritten to '/'
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('redirects to home when /giftcard has no hash parameters', async () => {
    // Set location to /giftcard without hash
    mockLocation.pathname = '/giftcard';
    mockLocation.hash = '';

    render(
      <TestApp>
        <Index />
      </TestApp>
    );

    // Should redirect to home page
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('redirects to home when /giftcard has incomplete hash parameters', async () => {
    // Set location to /giftcard with incomplete hash
    mockLocation.pathname = '/giftcard';
    mockLocation.hash = '#baseURL=https://ai.shakespeare.diy/v1';

    render(
      <TestApp>
        <Index />
      </TestApp>
    );

    // Should redirect to home page
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });
});
