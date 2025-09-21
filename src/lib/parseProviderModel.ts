import type { AIProvider } from '@/contexts/AISettingsContext';

export interface ParsedProviderModel {
  provider: string;
  model: string;
  connection: {
    baseURL: string;
    apiKey?: string;
    nostr?: boolean;
  };
}

/**
 * Parse a provider/model string and return the provider connection and model name
 * Format: provider/model (e.g., "openai/gpt-4o", "openrouter/anthropic/claude-sonnet-4")
 * The first slash separates the provider from the model
 */
export function parseProviderModel(
  providerModelString: string,
  providers: AIProvider[]
): ParsedProviderModel {
  const firstSlashIndex = providerModelString.indexOf('/');

  if (firstSlashIndex === -1) {
    throw new Error('Invalid format. Use provider/model (e.g., "openai/gpt-4o")');
  }

  const provider = providerModelString.substring(0, firstSlashIndex);
  const model = providerModelString.substring(firstSlashIndex + 1);

  if (!provider || !model) {
    throw new Error('Invalid format. Both provider and model must be specified');
  }

  const providerObj = providers.find(p => p.id === provider);
  if (!providerObj) {
    throw new Error(`Provider "${provider}" not found. Available providers: ${providers.map(p => p.id).join(', ')}`);
  }

  return {
    provider,
    model,
    connection: {
      baseURL: providerObj.baseURL,
      apiKey: providerObj.apiKey,
      nostr: providerObj.nostr,
    },
  };
}