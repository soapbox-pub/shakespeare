import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { createAIClient } from '@/lib/ai-client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

// Zod schemas for the two possible response formats
const creditsResponseV1Schema = z.object({
  object: z.literal('credits'),
  amount: z.number(),
});

const creditsResponseV2Schema = z.object({
  data: z.object({
    total_credits: z.number(),
    total_usage: z.number(),
  }),
});

// Union schema to handle both response formats
const creditsResponseSchema = z.union([creditsResponseV1Schema, creditsResponseV2Schema]);

// Normalized response type (always in V1 format)
export interface CreditsResponse {
  object: 'credits';
  amount: number;
}

/**
 * Custom hook to fetch AI provider credits
 * @param providerId - The ID of the AI provider
 * @param connection - The AI connection configuration
 * @returns Query result with credits information
 */
export function useAICredits(providerId: string, connection: {
  baseURL: string;
  apiKey?: string;
  nostr?: boolean;
}) {
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['ai-credits', connection.nostr ? user?.pubkey ?? '' : '', providerId],
    queryFn: async (): Promise<CreditsResponse> => {
      try {
        const ai = createAIClient(connection, user);
        const data = await ai.get('/credits');

        // Validate and normalize the response
        const parsed = creditsResponseSchema.parse(data);

        // Convert V2 format to V1 format if needed
        if ('data' in parsed) {
          return {
            object: 'credits',
            amount: parsed.data.total_credits - parsed.data.total_usage,
          };
        }

        // Already in V1 format
        return parsed;
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
  });
}