import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

    render(
      <TestApp>
        <AISettings />
      </TestApp>
    );

    // Should show login requirement for Shakespeare AI (Nostr preset)
    expect(screen.getByText('Log in to Nostr to use this provider')).toBeInTheDocument();
    expect(screen.getByText('Go to Nostr Settings')).toBeInTheDocument();
  });

  it('shows Add button for Nostr presets when user is logged in', async () => {
    const { useCurrentUser } = await import('@/hooks/useCurrentUser');
    vi.mocked(useCurrentUser).mockReturnValue({
      user: { pubkey: 'test-pubkey' } as NonNullable<ReturnType<typeof useCurrentUser>['user']>,
      users: [],
    });

    render(
      <TestApp>
        <AISettings />
      </TestApp>
    );

    // Should show Add button for Shakespeare AI (Nostr preset)
    const addButtons = screen.getAllByText('Add');
    expect(addButtons.length).toBeGreaterThan(0);

    // Should not show login requirement
    expect(screen.queryByText('Log in to Nostr to use this provider')).not.toBeInTheDocument();
  });

  it('shows normal input and Add button for non-Nostr presets regardless of login status', async () => {
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

    // Should show API key inputs for non-Nostr presets like OpenAI
    const openAIElements = screen.getAllByText('OpenAI');
    expect(openAIElements.length).toBeGreaterThan(0);
    const openRouterElements = screen.getAllByText('OpenRouter');
    expect(openRouterElements.length).toBeGreaterThan(0);

    // Should show Add buttons for non-Nostr presets
    const addButtons = screen.getAllByText('Add');
    expect(addButtons.length).toBeGreaterThan(0);
  });
});