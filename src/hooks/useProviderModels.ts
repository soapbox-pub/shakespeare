import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import OpenAI from 'openai';
import { useAISettings } from '@/hooks/useAISettings';

interface ProviderModel {
  id: string;
  name: string;
  provider: string;
  fullId: string; // provider/model format
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
        if (!connection.apiKey) {
          continue; // Skip providers without API keys
        }

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

            // Transform models to our format
            const providerModels = response.data.map((model) => ({
              id: model.id,
              name: model.id,
              provider: providerKey,
              fullId: `${providerKey}/${model.id}`,
            }));

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