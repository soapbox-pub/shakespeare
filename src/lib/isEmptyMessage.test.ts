import { describe, it, expect } from 'vitest';
import { isEmptyMessage } from './isEmptyMessage';
import type { AIMessage } from './SessionManager';

describe('isEmptyMessage', () => {
  it('returns false for user messages', () => {
    const message: AIMessage = {
      role: 'user',
      content: 'Hello',
    };

    expect(isEmptyMessage(message)).toBe(false);
  });

  it('returns false for tool messages', () => {
    const message: AIMessage = {
      role: 'tool',
      content: 'Tool result',
      tool_call_id: 'call_123',
    };

    expect(isEmptyMessage(message)).toBe(false);
  });

  it('returns true for assistant message with no content, reasoning, or tool calls', () => {
    const message: AIMessage = {
      role: 'assistant',
      content: '',
    };

    expect(isEmptyMessage(message)).toBe(true);
  });

  it('returns true for assistant message with only whitespace content', () => {
    const message: AIMessage = {
      role: 'assistant',
      content: '   \n\t  ',
    };

    expect(isEmptyMessage(message)).toBe(true);
  });

  it('returns false for assistant message with content', () => {
    const message: AIMessage = {
      role: 'assistant',
      content: 'Hello, how can I help?',
    };

    expect(isEmptyMessage(message)).toBe(false);
  });

  it('returns false for assistant message with reasoning content', () => {
    const message: AIMessage = {
      role: 'assistant',
      content: '',
      reasoning_content: 'Let me think about this...',
    };

    expect(isEmptyMessage(message)).toBe(false);
  });

  it('returns false for assistant message with tool calls', () => {
    const message: AIMessage = {
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: 'call_123',
          type: 'function',
          function: {
            name: 'text_editor_view',
            arguments: '{"path": "test.txt"}',
          },
        },
      ],
    };

    expect(isEmptyMessage(message)).toBe(false);
  });

  it('returns false for assistant message with array content', () => {
    const message: AIMessage = {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Hello',
        },
      ],
    };

    expect(isEmptyMessage(message)).toBe(false);
  });

  it('returns true for assistant message with empty array content', () => {
    const message: AIMessage = {
      role: 'assistant',
      content: [],
    };

    expect(isEmptyMessage(message)).toBe(true);
  });

  it('returns true for assistant message with array content containing only whitespace', () => {
    const message: AIMessage = {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: '   ',
        },
        {
          type: 'text',
          text: '\n\t',
        },
      ],
    };

    expect(isEmptyMessage(message)).toBe(true);
  });

  it('returns false for assistant message with content and reasoning', () => {
    const message: AIMessage = {
      role: 'assistant',
      content: 'Here is the answer',
      reasoning_content: 'I thought about this carefully',
    };

    expect(isEmptyMessage(message)).toBe(false);
  });

  it('returns true for assistant message with empty reasoning and no content', () => {
    const message: AIMessage = {
      role: 'assistant',
      content: '',
      reasoning_content: '   ',
    };

    expect(isEmptyMessage(message)).toBe(true);
  });
});
