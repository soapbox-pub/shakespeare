import OpenAI from 'openai';
import { NIP98Client } from '@nostrify/nostrify';
import type { NUser } from '@nostrify/react/login';
import type { AIProvider } from '@/contexts/AISettingsContext';

/**
 * Create an OpenAI client instance with the appropriate configuration.
 * If the connection requires Nostr authentication (NIP-98), it will use
 * the NIP98Client for authenticated requests.
 */
export function createAIClient(provider: AIProvider, user?: NUser): OpenAI {
  const baseConfig: ConstructorParameters<typeof OpenAI>[0] = {
    baseURL: provider.baseURL,
    apiKey: provider.apiKey ?? '',
    dangerouslyAllowBrowser: true,
    defaultHeaders: provider.id === 'openrouter' ? {
      // https://openrouter.ai/docs/app-attribution
      'HTTP-Referer': 'https://shakespeare.diy',
      'X-Title': 'Shakespeare',
    } : {},
  };

  let openai: OpenAI;

  // If Nostr authentication is required and we have a user, use NIP-98
  if (provider.nostr && user?.signer) {
    const nip98Client = new NIP98Client({ signer: user.signer });

    openai = new OpenAI({
      ...baseConfig,
      fetch: (input, init) => nip98Client.fetch(input, init),
    });
  } else {
    // Standard OpenAI client
    openai = new OpenAI(baseConfig);
  }

  const createCompletion: typeof openai.chat.completions.create
    = openai.chat.completions.create.bind(openai.chat.completions);

  openai.chat.completions.create = ((...[body, options]: Parameters<typeof createCompletion>) => {
    // OpenRouter usage accounting
    // https://openrouter.ai/docs/use-cases/usage-accounting
    if (provider.id === 'openrouter') {
      (body as { usage?: { include?: boolean } }).usage = { include: true };
    }

    return createCompletion(body, options);
  }) as typeof createCompletion;

  return openai;
}