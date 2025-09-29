import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { createAIClient } from '@/lib/ai-client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { AIProvider } from '@/contexts/AISettingsContext';

const creditsResponseSchema = z.object({
  object: z.literal('credits'),
  amount: z.number(),
});

// Normalized response type (always in V1 format)
export interface CreditsResponse {
  object: 'credits';
  amount: number;
}

/** Custom hook to fetch AI provider credits */
export function useAICredits(provider: AIProvider) {
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['ai-credits', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
    queryFn: async (): Promise<CreditsResponse> => {
      try {
        const ai = createAIClient(provider, user);
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
    enabled: !!provider.nostr && !!user,
  });
}