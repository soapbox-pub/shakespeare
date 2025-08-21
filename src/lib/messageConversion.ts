import { ModelMessage, generateId } from 'ai';
import { StreamingMessage } from '@/hooks/useStreamingChat';

/**
 * Convert ModelMessage array to StreamingMessage array
 * This is useful when loading chat history from storage
 */
export function convertModelMessagesToStreamingMessages(modelMessages: ModelMessage[]): StreamingMessage[] {
  const streamingMessages: StreamingMessage[] = [];

  for (const msg of modelMessages) {
    if (msg.role === 'user') {
      streamingMessages.push({
        id: generateId(),
        role: 'user',
        content: typeof msg.content === 'string' ? msg.content : msg.content.map(part => {
          if (part.type === 'text') return part.text;
          return '';
        }).join(''),
        timestamp: Date.now()
      });
    } else if (msg.role === 'assistant') {
      const streamingMessage: StreamingMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      };

      if (typeof msg.content === 'string') {
        streamingMessage.content = msg.content;
      } else if (Array.isArray(msg.content)) {
        // Extract text content
        const textParts = msg.content.filter(part => part.type === 'text');
        streamingMessage.content = textParts.map(part => part.text).join('');

        // Extract tool calls
        const toolCalls = msg.content.filter(part => part.type === 'tool-call');
        if (toolCalls.length > 0) {
          streamingMessage.toolCalls = toolCalls.map(tc => ({
            id: tc.toolCallId,
            toolName: tc.toolName,
            input: tc.input
          }));
        }
      }

      streamingMessages.push(streamingMessage);
    } else if (msg.role === 'tool') {
      // Tool results are typically integrated into the assistant message
      // but we can create a separate tool message if needed
      if (Array.isArray(msg.content)) {
        const toolResults = msg.content.map(result => ({
          toolCallId: result.toolCallId,
          toolName: result.toolName,
          output: result.output
        }));

        streamingMessages.push({
          id: generateId(),
          role: 'tool',
          content: '',
          toolResults,
          timestamp: Date.now()
        });
      }
    }
  }

  return streamingMessages;
}

/**
 * Convert StreamingMessage array to ModelMessage array
 * This is useful when saving chat history to storage or sending to AI
 */
export function convertStreamingMessagesToModelMessages(streamingMessages: StreamingMessage[]): ModelMessage[] {
  const modelMessages: ModelMessage[] = [];

  for (const msg of streamingMessages) {
    if (msg.role === 'user') {
      modelMessages.push({
        role: 'user',
        content: msg.content
      });
    } else if (msg.role === 'assistant') {
      // For assistant messages, just use text content for now
      // Tool calls will be handled by the AI SDK automatically during streaming
      if (msg.content) {
        modelMessages.push({
          role: 'assistant',
          content: msg.content
        });
      }
    }
    // Skip tool messages as they're handled differently in the streaming context
  }

  return modelMessages;
}

/**
 * Save chat history as ModelMessage array (for persistence)
 */
export function prepareChatHistoryForStorage(streamingMessages: StreamingMessage[]): ModelMessage[] {
  return convertStreamingMessagesToModelMessages(streamingMessages);
}

/**
 * Load chat history from ModelMessage array (from persistence)
 */
export function loadChatHistoryFromStorage(modelMessages: ModelMessage[]): StreamingMessage[] {
  return convertModelMessagesToStreamingMessages(modelMessages);
}