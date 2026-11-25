import { useQuery } from '@tanstack/react-query';
import { createAIClient } from '@/lib/ai-client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAppContext } from '@/hooks/useAppContext';
import type { AIProvider } from '@/contexts/AISettingsContext';
import type { PaymentMethods } from '@/lib/aiPayments';

/** What a provider sells credits for, its minimum and its fee. */
export function useAIPaymentMethods(provider: AIProvider, enabled = true) {
  const { user } = useCurrentUser();
  const { config } = useAppContext();

  return useQuery({
    // The same for everyone, so not keyed by account.
    queryKey: ['ai-payment-methods', provider.id, provider.baseURL],
    queryFn: async (): Promise<PaymentMethods> => {
      const ai = createAIClient(provider, user, config.corsProxy);
      return await ai.get('/credits/methods') as PaymentMethods;
    },
    enabled,
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 10 * 60 * 1000,
  });
}
