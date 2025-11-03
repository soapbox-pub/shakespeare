import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OnboardingDialog } from './OnboardingDialog';
import { TestApp } from '@/test/TestApp';

// Mock the hooks
vi.mock('@/hooks/useAISettings', () => ({
  useAISettings: () => ({
    settings: { providers: [], recentlyUsedModels: [] },
    setProvider: vi.fn(),
    removeProvider: vi.fn(),
    setProviders: vi.fn(),

    addRecentlyUsedModel: vi.fn(),
    updateSettings: vi.fn(),
    isConfigured: false,
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null }),
}));

vi.mock('@/hooks/useLoginActions', () => ({
  useLoginActions: () => ({ nsec: vi.fn() }),
}));

vi.mock('@/hooks/useProviderModels', () => ({
  useProviderModels: () => ({
    models: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

describe('OnboardingDialog', () => {
  it('renders welcome step when open', () => {
    render(
      <TestApp>
        <OnboardingDialog open={true} onOpenChange={vi.fn()} />
      </TestApp>
    );

    // Translations are rendered, so we check for the actual English text
    expect(screen.getByText('Welcome to Shakespeare!')).toBeInTheDocument();
    expect(screen.getByText(/Your AI-powered development assistant/)).toBeInTheDocument();
    // The button now shows the translated text "Get Started"
    expect(screen.getByRole('button', { name: 'Get Started' })).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <TestApp>
        <OnboardingDialog open={false} onOpenChange={vi.fn()} />
      </TestApp>
    );

    expect(screen.queryByText('Welcome to Shakespeare!')).not.toBeInTheDocument();
  });
});