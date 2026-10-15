import { describe, it, expect } from 'vitest';
import { mergeReasoningDetails, type ReasoningDetail } from './reasoningDetails';

describe('mergeReasoningDetails', () => {
  it('joins streamed text by index and keeps the final signature', () => {
    const acc: ReasoningDetail[] = [];
    mergeReasoningDetails(acc, [{ type: 'reasoning.text', text: 'Let me ', signature: null, format: 'anthropic-claude-v1', index: 0 }]);
    mergeReasoningDetails(acc, [{ type: 'reasoning.text', text: 'think.', index: 0 }]);
    mergeReasoningDetails(acc, [{ type: 'reasoning.text', signature: 'sig', index: 0 }]);

    expect(acc).toEqual([
      { type: 'reasoning.text', text: 'Let me think.', signature: 'sig', format: 'anthropic-claude-v1', index: 0 },
    ]);
  });

  it('keeps blocks with different indexes separate', () => {
    const acc: ReasoningDetail[] = [];
    mergeReasoningDetails(acc, [
      { type: 'reasoning.text', text: 'a', index: 0 },
      { type: 'reasoning.encrypted', data: 'xyz', index: 1 },
    ]);

    expect(acc).toHaveLength(2);
    expect(acc[1]).toEqual({ type: 'reasoning.encrypted', data: 'xyz', index: 1 });
  });
});
