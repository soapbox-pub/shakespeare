import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { createAIClient } from '@/lib/ai-client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAppContext } from '@/hooks/useAppContext';
import { AIProvider } from '@/contexts/AISettingsContext';

const creditsResponseSchema = z.object({
  object: z.literal('credits'),
  amount: z.number(),
  /** Bitcoin that's been sent but hasn't confirmed yet, valued as it will be credited. */
  pending: z.number().optional(),
  /** The part of `pending` that can be spent already. */
  advanced: z.number().optional(),
});

// Normalized response type (always in V1 format)
export interface CreditsResponse {
  object: 'credits';
  amount: number;
  pending?: number;
  advanced?: number;
}

/** Custom hook to fetch AI provider credits */
export function useAICredits(provider: AIProvider) {
  const { user } = useCurrentUser();
  const { config } = useAppContext();

  return useQuery({
    queryKey: ['ai-credits', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
    queryFn: async (): Promise<CreditsResponse> => {
      try {
        const ai = createAIClient(provider, user, config.corsProxy);
        const data = await ai.get('/credits');
        return creditsResponseSchema.parse(data);
      } catch (error) {
        if (error instanceof Error && !error.message.includes('Connection error')) {
          console.error('Error fetching AI credits:', error);
        }
        throw error;
      }
    },
    retry: false, // Don't retry as not all providers support this endpoint
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    // While bitcoin is confirming, look again now and then so it shows when it's credited.
    refetchInterval: (query) => (query.state.data?.pending ? 30_000 : false),
    enabled: !!provider.nostr && !!user,
  });
}