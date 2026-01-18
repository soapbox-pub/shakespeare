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
  const openai = new OpenAI({
    baseURL: provider.baseURL,
    apiKey: provider.apiKey ?? '',
    dangerouslyAllowBrowser: true,

    fetch: async (input, init) => {
      let request = new Request(input, init);

      // OpenSecret auth
      // https://docs.opensecret.cloud/docs/maple-ai/
      if (provider.openSecret) {
        const { createCustomFetch } = await import('@opensecret/react');
        return createCustomFetch({ apiKey: provider.apiKey, apiUrl: provider.openSecret })(input, init);
      }

      // Add OpenRouter headers
      // https://openrouter.ai/docs/app-attribution
      if (provider.id === 'openrouter') {
        const headers = new Headers(request.headers);
        headers.set('HTTP-Referer', 'https://shakespeare.diy');
        headers.set('X-Title', 'Shakespeare');
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
        request = new Request(proxyUrl({ template: corsProxy, url: request.url }), request);
      }

      return fetch(request);
    },
  });

  const createCompletion: typeof openai.chat.completions.create
    = openai.chat.completions.create.bind(openai.chat.completions);

  openai.chat.completions.create = ((...[body, options]: Parameters<typeof createCompletion>) => {
    // OpenRouter-specific hacks
    if (provider.id === "openrouter" || provider.baseURL === "https://openrouter.ai/api/v1") {
      // Usage accounting field to get token usage and cost per request
      // https://openrouter.ai/docs/use-cases/usage-accounting
      (body as { usage?: { include?: boolean } }).usage = { include: true };

      // Prompt caching for Claude models
      // https://openrouter.ai/docs/guides/best-practices/prompt-caching#anthropic-claude
      if (body.model.startsWith("anthropic/")) {
        // First normalize the message history to use content blocks
        body.messages = structuredClone(body.messages);
        body.messages = body.messages.map((m) => {
          if (m.role !== "function" && typeof m.content === "string") {
            return { ...m, content: [{ type: "text", text: m.content }] };
          } else {
            return m;
          }
        });

        const systemMessage = body.messages.find((m) => m.role === "system");
        const nonSystemMessages = body.messages.filter((m) => m.role !== "system");
        const lastTwoMessages = nonSystemMessages.slice(-2);

        if (systemMessage) {
          addCacheControl(systemMessage);
        }
        for (const msg of lastTwoMessages) {
          addCacheControl(msg);
        }
      }
    }

    return createCompletion(body, options);
  }) as typeof createCompletion;

  return openai;
}

/** Mutate msg to add an Anthropic `cache_control` property to its last text block */
function addCacheControl(msg: OpenAI.Chat.Completions.ChatCompletionMessageParam) {
  if (Array.isArray(msg.content)) {
    const lastTextBlock = msg.content.findLast((b) => b.type === "text");
    if (lastTextBlock) {
      (lastTextBlock as { cache_control?: { type: "ephemeral" } })
        .cache_control = { type: "ephemeral" };
    }
  }
};