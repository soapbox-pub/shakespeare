import type { AIConnection } from '@/contexts/AISettingsContext';

export interface ParsedProviderModel {
  provider: string;
  model: string;
  connection: AIConnection;
}

/**
 * Parse a provider/model string and return the provider connection and model name
 * Format: provider/model (e.g., "openai/gpt-4o", "openrouter/anthropic/claude-sonnet-4")
 * The first slash separates the provider from the model
 */
export function parseProviderModel(
  providerModelString: string,
  providers: Record<string, AIConnection>
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
  
  const connection = providers[provider];
  if (!connection) {
    throw new Error(`Provider "${provider}" not found. Available providers: ${Object.keys(providers).join(', ')}`);
  }
  
  if (!connection.apiKey) {
    throw new Error(`Provider "${provider}" is not configured with an API key`);
  }
  
  return {
    provider,
    model,
    connection,
  };
}