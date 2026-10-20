import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useProviderModels } from './useProviderModels';
import { useAISettings } from './useAISettings';
import { useCurrentUser } from './useCurrentUser';
import { useAppContext } from './useAppContext';
import { createAIClient } from '@/lib/ai-client';

vi.mock('./useAISettings');
vi.mock('./useCurrentUser');
vi.mock('./useAppContext');
vi.mock('@/lib/ai-client');

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function mockModelList(data: unknown[]) {
  vi.mocked(createAIClient).mockReturnValue({
    models: { list: vi.fn().mockResolvedValue({ data }) },
  } as unknown as ReturnType<typeof createAIClient>);
}

describe('useProviderModels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAISettings).mockReturnValue({
      settings: { providers: [{ id: 'meridian', baseURL: 'https://ai.example.com/v1' }] },
    } as unknown as ReturnType<typeof useAISettings>);
    vi.mocked(useCurrentUser).mockReturnValue({ user: undefined, users: [] });
    vi.mocked(useAppContext).mockReturnValue({
      config: { corsProxy: '' },
    } as unknown as ReturnType<typeof useAppContext>);
  });

  it('reads OpenRouter-style name and context_length', async () => {
    mockModelList([{ id: 'a/b', name: 'Model B', context_length: 128000 }]);

    const { result } = renderHook(() => useProviderModels(), { wrapper });

    await waitFor(() => expect(result.current.models).toHaveLength(1));
    expect(result.current.models[0]).toMatchObject({ name: 'Model B', contextLength: 128000 });
  });

  it('falls back to Anthropic-style display_name and context_window', async () => {
    mockModelList([{ id: 'claude-sonnet-5-5', display_name: 'Claude Sonnet 5.5', context_window: 1000000 }]);

    const { result } = renderHook(() => useProviderModels(), { wrapper });

    await waitFor(() => expect(result.current.models).toHaveLength(1));
    expect(result.current.models[0]).toMatchObject({
      id: 'claude-sonnet-5-5',
      fullId: 'meridian/claude-sonnet-5-5',
      name: 'Claude Sonnet 5.5',
      contextLength: 1000000,
    });
  });

  it('prefers name over display_name when both are present', async () => {
    mockModelList([{ id: 'x', name: 'Preferred', display_name: 'Fallback', context_length: 10, context_window: 20 }]);

    const { result } = renderHook(() => useProviderModels(), { wrapper });

    await waitFor(() => expect(result.current.models).toHaveLength(1));
    expect(result.current.models[0]).toMatchObject({ name: 'Preferred', contextLength: 10 });
  });
});
