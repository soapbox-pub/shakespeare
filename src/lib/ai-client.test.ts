import { describe, it, expect } from 'vitest';
import type OpenAI from 'openai';
import { applyOpenRouterTransforms } from './ai-client';

/**
 * Helper: minimal valid ChatCompletionCreateParams for transform tests.
 */
function makeBody(overrides: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams> = {})
  : OpenAI.Chat.Completions.ChatCompletionCreateParams {
  return {
    model: 'anthropic/claude-opus-4.6',
    messages: [
      { role: 'system', content: 'you are helpful' },
      { role: 'user', content: 'hello' },
    ],
    ...overrides,
  };
}

describe('applyOpenRouterTransforms', () => {
  it('adds usage accounting to the body regardless of model', () => {
    const body = makeBody({ model: 'openai/gpt-4' });
    applyOpenRouterTransforms(body);
    expect((body as { usage?: { include?: boolean } }).usage).toEqual({ include: true });
  });

  it('does not apply cache_control for non-Anthropic models', () => {
    const body = makeBody({
      model: 'openai/gpt-4',
      tools: [
        { type: 'function', function: { name: 't1', description: '', parameters: { type: 'object' } } },
      ],
    });
    applyOpenRouterTransforms(body);
    // messages remain as plain strings (no normalization)
    expect(body.messages[0].content).toBe('you are helpful');
    // tools untouched
    expect((body.tools![0] as { cache_control?: unknown }).cache_control).toBeUndefined();
  });

  it('places cache_control on the last tool for Anthropic models', () => {
    const body = makeBody({
      tools: [
        { type: 'function', function: { name: 't1', description: '', parameters: { type: 'object' } } },
        { type: 'function', function: { name: 't2', description: '', parameters: { type: 'object' } } },
        { type: 'function', function: { name: 't3', description: '', parameters: { type: 'object' } } },
      ],
    });
    applyOpenRouterTransforms(body);

    // Only the LAST tool gets cache_control — Anthropic caches everything
    // up to and including the marked block, so marking the last tool is
    // sufficient and we spend only one of the 4 breakpoints.
    expect((body.tools![0] as { cache_control?: unknown }).cache_control).toBeUndefined();
    expect((body.tools![1] as { cache_control?: unknown }).cache_control).toBeUndefined();
    expect((body.tools![2] as { cache_control?: { type: string } }).cache_control)
      .toEqual({ type: 'ephemeral' });
  });

  it('places cache_control on the system message and last two non-system messages', () => {
    const body = makeBody({
      messages: [
        { role: 'system', content: 'you are helpful' },
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'reply 1' },
        { role: 'user', content: 'second' },
        { role: 'assistant', content: 'reply 2' },
      ],
    });
    applyOpenRouterTransforms(body);

    const hasCache = (m: OpenAI.Chat.Completions.ChatCompletionMessageParam): boolean => {
      if (!Array.isArray(m.content)) return false;
      return m.content.some((b) => {
        const block = b as { cache_control?: unknown };
        return block.cache_control !== undefined;
      });
    };

    // System: cached
    expect(hasCache(body.messages[0])).toBe(true);
    // Old turns: not cached
    expect(hasCache(body.messages[1])).toBe(false);
    expect(hasCache(body.messages[2])).toBe(false);
    // Last two non-system: cached
    expect(hasCache(body.messages[3])).toBe(true);
    expect(hasCache(body.messages[4])).toBe(true);
  });

  it('skips empty text when placing message cache breakpoints', () => {
    const toolCall = { id: 't1', type: 'function' as const, function: { name: 'shell', arguments: '{}' } };
    const body = makeBody({
      messages: [
        { role: 'system', content: 'you are helpful' },
        { role: 'user', content: 'build it' },
        { role: 'assistant', content: '', tool_calls: [toolCall] },
        { role: 'tool', tool_call_id: 't1', content: 'ok' },
      ],
    });
    applyOpenRouterTransforms(body);

    // The tool-only assistant turn keeps its empty string and gets no breakpoint.
    expect(body.messages[2].content).toBe('');
    const markedText = (m: OpenAI.Chat.Completions.ChatCompletionMessageParam) =>
      Array.isArray(m.content) && m.content.some((b) => (b as { cache_control?: unknown }).cache_control !== undefined);
    expect(markedText(body.messages[1])).toBe(true);
    expect(markedText(body.messages[3])).toBe(true);
  });

  it('normalizes string content to text block arrays for Anthropic', () => {
    const body = makeBody();
    applyOpenRouterTransforms(body);
    // System and user both turned into arrays of text blocks
    expect(Array.isArray(body.messages[0].content)).toBe(true);
    expect(Array.isArray(body.messages[1].content)).toBe(true);
    const sysBlocks = body.messages[0].content as Array<{ type: string; text: string }>;
    expect(sysBlocks[0]).toEqual(
      expect.objectContaining({ type: 'text', text: 'you are helpful' }),
    );
  });

  it('does not crash when tools is undefined or empty', () => {
    const a = makeBody();
    expect(() => applyOpenRouterTransforms(a)).not.toThrow();
    expect(a.tools).toBeUndefined();

    const b = makeBody({ tools: [] });
    expect(() => applyOpenRouterTransforms(b)).not.toThrow();
    expect(b.tools).toEqual([]);
  });

  it('does not mutate the original tools array reference (uses structuredClone)', () => {
    const originalTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      { type: 'function', function: { name: 't1', description: '', parameters: { type: 'object' } } },
    ];
    const originalRef = originalTools;
    const body = makeBody({ tools: originalTools });
    applyOpenRouterTransforms(body);

    // body.tools is now a clone, original array untouched
    expect(body.tools).not.toBe(originalRef);
    expect((originalTools[0] as { cache_control?: unknown }).cache_control).toBeUndefined();
    // But body.tools has cache_control
    expect((body.tools![0] as { cache_control?: { type: string } }).cache_control)
      .toEqual({ type: 'ephemeral' });
  });

  it('produces byte-identical output across two calls with the same input (cache stability)', () => {
    // This is the property the Anthropic cache relies on: the tools block
    // hashes to the same value on every turn. If this test ever fails, tool
    // caching will silently stop working.
    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      { type: 'function', function: { name: 'a', description: 'x', parameters: { type: 'object', properties: { foo: { type: 'string' } } } } },
      { type: 'function', function: { name: 'b', description: 'y', parameters: { type: 'object' } } },
    ];

    const body1 = makeBody({ tools: structuredClone(tools) });
    const body2 = makeBody({ tools: structuredClone(tools) });
    applyOpenRouterTransforms(body1);
    applyOpenRouterTransforms(body2);

    expect(JSON.stringify(body1.tools)).toEqual(JSON.stringify(body2.tools));
  });
});
