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
      // OpenSecret auth
      // https://docs.opensecret.cloud/docs/maple-ai/
      if (provider.openSecret) {
        const { createCustomFetch } = await import('@opensecret/react');
        return createCustomFetch({ apiKey: provider.apiKey, apiUrl: provider.openSecret })(input, init);
      }

      let request = new Request(input, init);

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
    if (isOpenRouter(provider)) {
      applyOpenRouterTransforms(body);
    }

    return createCompletion(body, options);
  }) as typeof createCompletion;

  return openai;
}

export function isOpenRouter(provider: AIProvider): boolean {
  return provider.id === "openrouter" || provider.baseURL === "https://openrouter.ai/api/v1";
}

/**
 * Apply OpenRouter-specific request body mutations: opt into usage accounting,
 * and (for Anthropic models) place `cache_control` breakpoints so the tools
 * array, system prompt, and last two messages get cached. Exported for tests.
 *
 * References:
 *   - OpenRouter prompt caching guide:
 *     https://openrouter.ai/docs/guides/best-practices/prompt-caching#anthropic-claude
 *   - OpenRouter tool caching announcement: "gif-prompts-omni-search-tool-caching-and-byok-flags"
 *   - Anthropic prompt caching docs:
 *     https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
 *
 * Anthropic's cache hierarchy is `tools` → `system` → `messages`. We use all
 * four breakpoints Anthropic allows per request:
 *   1. last tool definition      (caches the entire tools array)
 *   2. system message             (caches system prompt + AGENTS.md)
 *   3. second-to-last non-system  (caches most of conversation)
 *   4. last non-system            (caches everything including latest msg)
 */
export function applyOpenRouterTransforms(
  body: OpenAI.Chat.Completions.ChatCompletionCreateParams,
): void {
  // Usage accounting field to get token usage and cost per request.
  // https://openrouter.ai/docs/use-cases/usage-accounting
  (body as { usage?: { include?: boolean } }).usage = { include: true };

  if (!body.model.startsWith("anthropic/")) return;

  // Normalize the message history to use content blocks so we can attach
  // cache_control to individual text parts. Empty strings (assistant turns
  // that only call tools) stay as they are: Anthropic rejects empty text
  // blocks, and cache_control on one.
  body.messages = structuredClone(body.messages);
  body.messages = body.messages.map((m) => {
    if (m.role !== "function" && typeof m.content === "string" && m.content) {
      return { ...m, content: [{ type: "text", text: m.content }] };
    } else {
      return m;
    }
  });

  const systemMessage = body.messages.find((m) => m.role === "system");
  const nonSystemMessages = body.messages.filter((m) => m.role !== "system");

  if (systemMessage) {
    addCacheControl(systemMessage);
  }
  // Mark the last two messages that have text to put a breakpoint on.
  let breakpoints = 0;
  for (let i = nonSystemMessages.length - 1; i >= 0 && breakpoints < 2; i--) {
    if (addCacheControl(nonSystemMessages[i])) breakpoints++;
  }

  // Cache the tools array by marking the last tool with cache_control.
  // Anthropic caches everything up to and including the marked block, so
  // marking just the last tool caches the whole array. The tools array
  // must be byte-stable across turns for cache hits — Shakespeare builds
  // it once per session in `ChatPane`, so this holds as long as we don't
  // mutate session.tools mid-session.
  //
  // Note: the OpenAI SDK serializes the body via plain `JSON.stringify`
  // (see node_modules/openai/internal/request-options) and does not strip
  // unknown fields, so the `cache_control` property survives the trip to
  // OpenRouter.
  if (body.tools && body.tools.length > 0) {
    body.tools = structuredClone(body.tools);
    const lastTool = body.tools[body.tools.length - 1];
    (lastTool as { cache_control?: { type: "ephemeral" } })
      .cache_control = { type: "ephemeral" };
  }
}

/**
 * Mutate msg to add an Anthropic `cache_control` property to its last
 * non-empty text block. Returns whether a block was marked.
 */
function addCacheControl(msg: OpenAI.Chat.Completions.ChatCompletionMessageParam): boolean {
  if (Array.isArray(msg.content)) {
    const lastTextBlock = msg.content.findLast((b) => b.type === "text" && b.text !== "");
    if (lastTextBlock) {
      (lastTextBlock as { cache_control?: { type: "ephemeral" } })
        .cache_control = { type: "ephemeral" };
      return true;
    }
  }
  return false;
};