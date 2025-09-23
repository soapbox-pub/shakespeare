import OpenAI from 'openai';
import { NIP98Client } from '@nostrify/nostrify';
import type { NUser } from '@nostrify/react/login';

/**
 * Create an OpenAI client instance with the appropriate configuration.
 * If the connection requires Nostr authentication (NIP-98), it will use
 * the NIP98Client for authenticated requests.
 */
export function createAIClient(connection: {
  baseURL: string;
  apiKey?: string;
  nostr?: boolean;
}, user?: NUser): OpenAI {
  const baseConfig: ConstructorParameters<typeof OpenAI>[0] = {
    baseURL: connection.baseURL,
    apiKey: connection.apiKey ?? '',
    dangerouslyAllowBrowser: true,
    defaultHeaders: {
      // https://openrouter.ai/docs/app-attribution
      'HTTP-Referer': 'https://shakespeare.diy',
      'X-Title': 'Shakespeare',
    },
  };

  // If Nostr authentication is required and we have a user, use NIP-98
  if (connection.nostr && user?.signer) {
    const nip98Client = new NIP98Client({ signer: user.signer });

    return new OpenAI({
      ...baseConfig,
      fetch: (input, init) => nip98Client.fetch(input, init),
    });
  }

  // Standard OpenAI client
  return new OpenAI(baseConfig);
}