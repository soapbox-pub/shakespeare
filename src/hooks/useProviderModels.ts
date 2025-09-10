import { Decimal } from 'decimal.js';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import OpenAI from 'openai';
import { useAISettings } from '@/hooks/useAISettings';

interface ProviderModel {
  id: string;
  name: string;
  provider: string;
  fullId: string; // provider/model format
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
  const [error, setError] = useState<string | null>(null);

  const {
    data: models = [],
    isLoading,
    refetch: queryRefetch,
  } = useQuery({
    queryKey: ['provider-models', settings.providers],
    queryFn: async () => {
      const allModels: ProviderModel[] = [];
      const errors: string[] = [];

      // Fetch models from each configured provider
      for (const [providerKey, connection] of Object.entries(settings.providers)) {
        try {
          const openai = new OpenAI({
            baseURL: connection.baseURL,
            apiKey: connection.apiKey,
            dangerouslyAllowBrowser: true,
          });

          // Fetch models with timeout
          try {
            const response = await openai.models.list({
              signal: AbortSignal.timeout(10_000),
            });

            console.log(response);

            // Transform models to our format
            const providerModels = response.data.map((model) => {
              const providerModel: ProviderModel = {
                id: model.id,
                name: model.id,
                provider: providerKey,
                fullId: `${providerKey}/${model.id}`,
              };

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

            allModels.push(...providerModels);
          } catch (fetchError) {
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
              errors.push(`${providerKey}: Request timeout`);
            } else {
              throw fetchError;
            }
          }
        } catch (providerError) {
          console.warn(`Failed to fetch models from ${providerKey}:`, providerError);
          errors.push(
            `${providerKey}: ${
              providerError instanceof Error ? providerError.message : 'Unknown error'
            }`
          );
        }
      }

      // Set error state if there were any errors
      if (errors.length > 0) {
        setError(errors.join('; '));
      } else {
        setError(null);
      }

      // Sort models by provider, then by name
      allModels.sort((a, b) => {
        if (a.provider !== b.provider) {
          return a.provider.localeCompare(b.provider);
        }
        return a.name.localeCompare(b.name);
      });

      return allModels;
    },
    enabled: Object.keys(settings.providers).length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false, // Don't retry on failure
  });

  const refetch = useCallback(() => {
    setError(null);
    queryRefetch();
  }, [queryRefetch]);

  return {
    models,
    isLoading,
    error,
    refetch,
  };
}