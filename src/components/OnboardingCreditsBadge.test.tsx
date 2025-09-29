import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { OnboardingCreditsBadge } from './OnboardingCreditsBadge';
import type { UseQueryResult } from '@tanstack/react-query';
import type { CreditsResponse } from '@/hooks/useAICredits';

// Mock the useAICredits hook
vi.mock('@/hooks/useAICredits', () => ({
  useAICredits: vi.fn(),
}));

import { useAICredits } from '@/hooks/useAICredits';

const mockUseAICredits = vi.mocked(useAICredits);

describe('OnboardingCreditsBadge', () => {
  const mockProvider = {
    id: 'shakespeare',
    baseURL: 'https://ai.shakespeare.diy/v1',
    nostr: true,
  };

  it('renders credits badge when data is available', () => {
    mockUseAICredits.mockReturnValue({
      data: { object: 'credits', amount: 25.50 },
      isLoading: false,
      error: null,
    } as UseQueryResult<CreditsResponse, Error>);

    render(
      <TestApp>
        <OnboardingCreditsBadge provider={mockProvider} />
      </TestApp>
    );

    expect(screen.getByText('$25.50')).toBeInTheDocument();
  });

  it('does not render when loading', () => {
    mockUseAICredits.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as UseQueryResult<CreditsResponse, Error>);

    const { container } = render(
      <TestApp>
        <OnboardingCreditsBadge provider={mockProvider} />
      </TestApp>
    );

    expect(container.firstChild).toBeNull();
  });

  it('does not render when there is an error', () => {
    mockUseAICredits.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Provider does not support credits'),
    } as UseQueryResult<CreditsResponse, Error>);

    const { container } = render(
      <TestApp>
        <OnboardingCreditsBadge provider={mockProvider} />
      </TestApp>
    );

    expect(container.firstChild).toBeNull();
  });

  it('does not render when no credits data is available', () => {
    mockUseAICredits.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as UseQueryResult<CreditsResponse, Error>);

    const { container } = render(
      <TestApp>
        <OnboardingCreditsBadge provider={mockProvider} />
      </TestApp>
    );

    expect(container.firstChild).toBeNull();
  });

  it('does not render when credits amount is 0', () => {
    mockUseAICredits.mockReturnValue({
      data: { object: 'credits', amount: 0 },
      isLoading: false,
      error: null,
    } as UseQueryResult<CreditsResponse, Error>);

    const { container } = render(
      <TestApp>
        <OnboardingCreditsBadge provider={mockProvider} />
      </TestApp>
    );

    expect(container.firstChild).toBeNull();
  });
});