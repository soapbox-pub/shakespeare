/**
 * OpenRouter's structured reasoning blocks. Anthropic thinking comes back as
 * `reasoning.text` (with a signature) or `reasoning.encrypted`, and must be
 * sent back unmodified on the assistant message for the model to continue its
 * reasoning after a tool call.
 *
 * https://openrouter.ai/docs/guides/best-practices/reasoning-tokens#preserving-reasoning
 */
export interface ReasoningDetail {
  type: string;
  index?: number;
  text?: string;
  summary?: string;
  data?: string;
  signature?: string | null;
  [key: string]: unknown;
}

/** Fold streamed `delta.reasoning_details` chunks into `acc`, joining pieces that share an index. */
export function mergeReasoningDetails(acc: ReasoningDetail[], chunks: ReasoningDetail[]): void {
  for (const chunk of chunks) {
    const existing = chunk.index !== undefined
      ? acc.find((detail) => detail.index === chunk.index && detail.type === chunk.type)
      : undefined;

    if (!existing) {
      acc.push({ ...chunk });
      continue;
    }

    for (const [key, value] of Object.entries(chunk)) {
      if (value === undefined || value === null) continue;
      if (key === 'text' || key === 'summary' || key === 'data') {
        existing[key] = (existing[key] ?? '') + String(value);
      } else {
        existing[key] = value;
      }
    }
  }
}
