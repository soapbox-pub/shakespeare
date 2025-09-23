import type { AIProvider } from '@/contexts/AISettingsContext';

export interface ParsedProviderModel {
  model: string;
  provider: AIProvider;
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

  const providerId = providerModelString.substring(0, firstSlashIndex);
  const model = providerModelString.substring(firstSlashIndex + 1);

  if (!providerId || !model) {
    throw new Error('Invalid format. Both provider and model must be specified');
  }

  const provider = providers.find(p => p.id === providerId);
  if (!provider) {
    throw new Error(`Provider "${providerId}" not found. Available providers: ${providers.map(p => p.id).join(', ')}`);
  }

  return {
    model,
    provider,
  };
}