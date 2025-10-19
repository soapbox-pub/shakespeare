import OpenAI from 'openai';
import { NIP98 } from '@nostrify/nostrify';
import { N64 } from '@nostrify/nostrify/utils';
import type { NUser } from '@nostrify/react/login';
import type { AIProvider } from '@/contexts/AISettingsContext';
import { proxyUrl } from './proxyUrl';

/**
 * Create an OpenAI client instance with the appropriate configuration.
 * If the connection requires Nostr authentication (NIP-98), it will use
 * the NIP98Client for authenticated requests.
 * If the provider has proxy enabled, requests will be proxied through the corsProxy.
 */
export function createAIClient(provider: AIProvider, user?: NUser, corsProxy?: string): OpenAI {
  const baseConfig: ConstructorParameters<typeof OpenAI>[0] = {
    baseURL: provider.baseURL,
    apiKey: provider.apiKey ?? '',
    dangerouslyAllowBrowser: true,
  };

  const openai = new OpenAI({
    ...baseConfig,
    fetch: async (input, init) => {
      let request = new Request(input, init);

      // Add OpenRouter headers
      // https://openrouter.ai/docs/app-attribution
      if (provider.id === 'openrouter') {
        const headers = new Headers(request.headers);
        headers.set('HTTP-Referer', 'https://shakespeare.diy');
        headers.set('X-Title', 'Shakespeare');
        request = new Request(request, { headers });
      }

      // Add Anthropic-specific headers
      // https://docs.anthropic.com/en/api/versioning
      if (provider.id === 'anthropic') {
        const headers = new Headers(request.headers);
        headers.set('anthropic-version', '2023-06-01');
        // Required header for direct browser access
        headers.set('anthropic-dangerous-direct-browser-access', 'true');
        // Anthropic expects x-api-key header instead of Authorization: Bearer
        if (provider.apiKey) {
          headers.set('x-api-key', provider.apiKey);
          headers.delete('authorization'); // Remove the Bearer token that OpenAI client adds
        }
        request = new Request(request, { headers });
      }

      // If Nostr authentication is required and we have a user, use NIP-98
      if (provider.nostr && user?.signer) {
        // Create the NIP98 token
        const template = await NIP98.template(request);
        const event = await user.signer.signEvent(template);
        const token = N64.encodeEvent(event);

        // Add the Authorization header
        const headers = new Headers(request.headers);
        headers.set('Authorization', `Nostr ${token}`);
        request = new Request(request, { headers });
      }

      // If proxy is enabled and we have a CORS proxy URL, modify the request URL
      if (provider.proxy && corsProxy) {
        request = new Request(proxyUrl(corsProxy, request.url), request);
      }

      return fetch(request);
    },
  });

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