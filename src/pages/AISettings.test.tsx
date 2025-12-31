import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { TestApp } from '@/test/TestApp';
import { AISettings } from './AISettings';

// Mock the hooks
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(),
}));

vi.mock('@/hooks/useAISettings', () => ({
  useAISettings: vi.fn(() => ({
    settings: { providers: [] },
    setProvider: vi.fn(),
    removeProvider: vi.fn(),
    setProviders: vi.fn(),
    updateSettings: vi.fn(),
    addRecentlyUsedModel: vi.fn(),
    isConfigured: false,
    isLoading: false,
  })),
}));

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: vi.fn(() => false),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(() => vi.fn()),
    Link: ({ children, to, ...props }: { children: React.ReactNode; to: string; [key: string]: unknown }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

describe('AISettings', () => {
  it('shows Nostr login requirement for Nostr presets when user is not logged in', async () => {
    const { useCurrentUser } = await import('@/hooks/useCurrentUser');
    vi.mocked(useCurrentUser).mockReturnValue({
      user: undefined,
      users: [],
    });

    const user = userEvent.setup();

    render(
      <TestApp>
        <AISettings />
      </TestApp>
    );

    // Find and click on the Shakespeare AI tile (Nostr preset)
    const shakespeareTile = screen.getByText('Shakespeare AI');
    await user.click(shakespeareTile);

    // Wait for dialog to open and show login requirement
    await waitFor(() => {
      expect(screen.getByText('Log in to Nostr to use this provider')).toBeInTheDocument();
    });
    expect(screen.getByText('Go to Nostr Settings')).toBeInTheDocument();
  });

  it('shows API key input for Nostr presets when user is logged in', async () => {
    const { useCurrentUser } = await import('@/hooks/useCurrentUser');
    vi.mocked(useCurrentUser).mockReturnValue({
      user: { pubkey: 'test-pubkey' } as NonNullable<ReturnType<typeof useCurrentUser>['user']>,
      users: [],
    });

    const user = userEvent.setup();

    render(
      <TestApp>
        <AISettings />
      </TestApp>
    );

    // Find and click on the Shakespeare AI tile (Nostr preset)
    const shakespeareTile = screen.getByText('Shakespeare AI');
    await user.click(shakespeareTile);

    // Wait for dialog to open - should NOT show login requirement
    await waitFor(() => {
      expect(screen.queryByText('Log in to Nostr to use this provider')).not.toBeInTheDocument();
    });
  });

  it('shows provider tiles for presets', async () => {
    const { useCurrentUser } = await import('@/hooks/useCurrentUser');
    vi.mocked(useCurrentUser).mockReturnValue({
      user: undefined,
      users: [],
    });

    render(
      <TestApp>
        <AISettings />
      </TestApp>
    );

    // Should show provider tiles for presets like OpenAI
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('OpenRouter')).toBeInTheDocument();
    expect(screen.getByText('Shakespeare AI')).toBeInTheDocument();
  });
});