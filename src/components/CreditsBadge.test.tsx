import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CreditsBadge } from './CreditsBadge';
import { TestApp } from '@/test/TestApp';
import type { AIConnection } from '@/contexts/AISettingsContext';

// Mock the useAICredits hook
vi.mock('@/hooks/useAICredits', () => ({
  useAICredits: vi.fn(),
}));

import { useAICredits } from '@/hooks/useAICredits';
const mockUseAICredits = vi.mocked(useAICredits);

describe('CreditsBadge', () => {
  const mockConnection: AIConnection = {
    baseURL: 'https://api.example.com/v1',
    apiKey: 'test-key',
  };

  it('should render credits badge with formatted amount', () => {
    mockUseAICredits.mockReturnValue({
      data: { object: 'credits', amount: 25.50 },
      isLoading: false,
      error: null,
      isSuccess: true,
      isError: false,
    } as any);

    render(
      <TestApp>
        <CreditsBadge providerId="test-provider" connection={mockConnection} />
      </TestApp>
    );

    expect(screen.getByText('$25.50')).toBeInTheDocument();
  });

  it('should not render anything when loading', () => {
    mockUseAICredits.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isSuccess: false,
      isError: false,
    } as any);

    const { container } = render(
      <TestApp>
        <CreditsBadge providerId="test-provider" connection={mockConnection} />
      </TestApp>
    );

    expect(container.firstChild).toBeNull();
  });

  it('should not render anything when there is an error', () => {
    mockUseAICredits.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch'),
      isSuccess: false,
      isError: true,
    } as any);

    const { container } = render(
      <TestApp>
        <CreditsBadge providerId="test-provider" connection={mockConnection} />
      </TestApp>
    );

    expect(container.firstChild).toBeNull();
  });

  it('should not render anything when no credits data is available', () => {
    mockUseAICredits.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      isSuccess: true,
      isError: false,
    } as any);

    const { container } = render(
      <TestApp>
        <CreditsBadge providerId="test-provider" connection={mockConnection} />
      </TestApp>
    );

    expect(container.firstChild).toBeNull();
  });

  it('should format large amounts correctly', () => {
    mockUseAICredits.mockReturnValue({
      data: { object: 'credits', amount: 1234.56 },
      isLoading: false,
      error: null,
      isSuccess: true,
      isError: false,
    } as any);

    render(
      <TestApp>
        <CreditsBadge providerId="test-provider" connection={mockConnection} />
      </TestApp>
    );

    expect(screen.getByText('$1,234.56')).toBeInTheDocument();
  });

  it('should format zero amounts correctly', () => {
    mockUseAICredits.mockReturnValue({
      data: { object: 'credits', amount: 0 },
      isLoading: false,
      error: null,
      isSuccess: true,
      isError: false,
    } as any);

    render(
      <TestApp>
        <CreditsBadge providerId="test-provider" connection={mockConnection} />
      </TestApp>
    );

    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });
});