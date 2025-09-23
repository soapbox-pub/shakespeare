import { Decimal } from 'decimal.js';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAISettings } from '@/hooks/useAISettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { createAIClient } from '@/lib/ai-client';

interface ProviderModel {
  id: string;
  name?: string;
  provider: string;
  fullId: string; // provider/model format
  description?: string;
  /** Maximum size of context window, if available */
  contextLength?: number;
  /** Pricing information, if available */
  pricing?: {
    /** Input/prompt pricing per token */
    prompt: Decimal;
    /** Output/completion pricing per token */
    completion: Decimal;
  }
}

interface ModelFetchResult {
  models: ProviderModel[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useProviderModels(): ModelFetchResult {
  const { settings } = useAISettings();
  const { user } = useCurrentUser();
  const [error, setError] = useState<string | null>(null);

  const {
    data: models = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['provider-models', settings.providers],
    queryFn: async () => {
      const errors: string[] = [];

      // Fetch models from each configured provider in parallel
      const providerPromises = settings.providers.map(async (provider) => {
        try {
          const openai = createAIClient(provider, user);

          // Fetch models with timeout
          try {
            const response = await openai.models.list({
              signal: AbortSignal.timeout(10_000),
            });

            // Transform models to our format
            const providerModels = response.data.map((model) => {
              const providerModel: ProviderModel = {
                id: model.id,
                provider: provider.id,
                fullId: `${provider.id}/${model.id}`,
              };

              if ('name' in model && typeof model.name === 'string') {
                providerModel.name = model.name;
              }

              if ('description' in model && typeof model.description === 'string') {
                providerModel.description = model.description;
              }

              if ('context_length' in model && typeof model.context_length === 'number') {
                providerModel.contextLength = model.context_length;
              }

              if (
                "pricing" in model && model.pricing && typeof model.pricing === "object" &&
                "prompt" in model.pricing && "completion" in model.pricing &&
                typeof model.pricing.prompt === "string" &&
                typeof model.pricing.completion === "string" &&
                !isNaN(Number(model.pricing.prompt)) &&
                !isNaN(Number(model.pricing.completion))
              ) {
                providerModel.pricing = {
                  prompt: new Decimal(model.pricing.prompt),
                  completion: new Decimal(model.pricing.completion),
                };
              }

              return providerModel;
            });

            return providerModels;
          } catch (fetchError) {
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
              errors.push(`${provider.id}: Request timeout`);
            } else {
              throw fetchError;
            }
            return [];
          }
        } catch (providerError) {
          console.warn(`Failed to fetch models from ${provider.id}:`, providerError);
          errors.push(
            `${provider.id}: ${
              providerError instanceof Error ? providerError.message : 'Unknown error'
            }`
          );
          return [];
        }
      });

      // Wait for all provider requests to complete
      const providerResults = await Promise.all(providerPromises);

      // Flatten all models into a single array
      const allModels = providerResults.flat();

      // Set error state if there were any errors
      if (errors.length > 0) {
        setError(errors.join('; '));
      } else {
        setError(null);
      }

      return allModels;
    },
    enabled: settings.providers.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false, // Don't retry on failure
  });

  return {
    models,
    isLoading,
    error,
    refetch,
  };
}