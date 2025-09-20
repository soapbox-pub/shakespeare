import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OnboardingDialog } from './OnboardingDialog';
import { TestApp } from '@/test/TestApp';

// Mock the hooks
vi.mock('@/hooks/useAISettings', () => ({
  useAISettings: () => ({
    settings: { providers: {}, recentlyUsedModels: [] },
    addProvider: vi.fn(),
    addRecentlyUsedModel: vi.fn(),
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

    expect(screen.getAllByText('Welcome to Shakespeare!')).toHaveLength(2); // Title and heading
    expect(screen.getByText(/Your AI-powered development assistant/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Get Started/i })).toBeInTheDocument();
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