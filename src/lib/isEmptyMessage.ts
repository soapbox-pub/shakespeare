import type { AIMessage } from './SessionManager';

/**
 * Type guard to check if message has reasoning content
 */
function hasReasoningContent(message: AIMessage): message is AIMessage & { reasoning_content: string } {
  return (
    message.role === 'assistant' &&
    'reasoning_content' in message &&
    typeof (message as { reasoning_content?: unknown }).reasoning_content === 'string'
  );
}

/**
 * Get the text content from a message, handling both string and array formats
 */
function getMessageContent(message: AIMessage): string {
  if (typeof message.content === 'string') {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map(item => {
        if (typeof item === 'string') return item;
        if (item.type === 'text') return item.text;
        return '';
      })
      .join('\n');
  }
  return '';
}

/**
 * Check if an assistant message is considered "empty"
 * A message is empty if:
 * - Its trimmed text content is empty
 * - Its reasoning content (if present) is empty
 * - It has no tool calls
 */
export function isEmptyMessage(message: AIMessage): boolean {
  // Only check assistant messages
  if (message.role !== 'assistant') {
    return false;
  }

  const content = getMessageContent(message).trim();
  const reasoningContent = hasReasoningContent(message) ? message.reasoning_content.trim() : '';
  const hasToolCalls = message.tool_calls && message.tool_calls.length > 0;

  // Message is empty if there's no content, no reasoning, and no tool calls
  return !content && !reasoningContent && !hasToolCalls;
}
