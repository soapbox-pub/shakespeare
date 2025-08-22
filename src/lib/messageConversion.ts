import { ModelMessage, generateId } from 'ai';
import { ChatMessage } from '@/hooks/useStreamingChat';

/**
 * Convert ModelMessage array to ChatMessage array
 * This is useful when loading chat history from storage
 */
export function convertModelMessagesToChatMessages(modelMessages: ModelMessage[]): ChatMessage[] {
  return modelMessages.map(msg => ({
    ...msg,
    id: generateId(),
    timestamp: Date.now()
  }));
}

/**
 * Convert ChatMessage array to ModelMessage array
 * This is useful when saving chat history to storage or sending to AI
 */
export function convertChatMessagesToModelMessages(chatMessages: ChatMessage[]): ModelMessage[] {
  return chatMessages.map(({ id, isStreaming, timestamp, ...modelMessage }) => modelMessage);
}

/**
 * Save chat history as ModelMessage array (for persistence)
 */
export function prepareChatHistoryForStorage(chatMessages: ChatMessage[]): ModelMessage[] {
  return convertChatMessagesToModelMessages(chatMessages);
}

/**
 * Load chat history from ModelMessage array (from persistence)
 */
export function loadChatHistoryFromStorage(modelMessages: ModelMessage[]): ChatMessage[] {
  return convertModelMessagesToChatMessages(modelMessages);
}