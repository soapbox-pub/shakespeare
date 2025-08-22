import { useState, useCallback, useRef } from 'react';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText, ModelMessage, generateId, Tool, stepCountIs } from 'ai';
import type { TextPart, ToolCallPart, ToolResultPart } from 'ai';
import { useAISettings } from '@/hooks/useAISettings';

// Extend ModelMessage with additional UI state
export type ChatMessage = ModelMessage & {
  id: string;
  isStreaming?: boolean;
  timestamp?: number;
}

interface UseStreamingChatOptions {
  projectId: string;
  projectName: string;
  tools?: Record<string, Tool>;
  systemPrompt?: string;
  onStepFinish?: (stepResult: unknown) => void;
  onUpdateMetadata?: (title: string, description: string) => void;
}

export function useStreamingChat({
  projectName,
  tools = {},
  systemPrompt,
  onStepFinish,
  onUpdateMetadata
}: UseStreamingChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamingMessageId, setCurrentStreamingMessageId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { settings, isConfigured } = useAISettings();

  // Convert ChatMessage to ModelMessage for AI SDK
  const convertToModelMessages = useCallback((chatMessages: ChatMessage[]): ModelMessage[] => {
    return chatMessages.map(({ id, isStreaming, timestamp, ...modelMessage }) => modelMessage as ModelMessage);
  }, []);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => {
      const messageMap = new Map(prev.map(m => [m.id, m]));
      messageMap.set(message.id, message);
      return Array.from(messageMap.values());
    });
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage> | ((prev: ChatMessage) => Partial<ChatMessage>)) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === id) {
        const updatesObj = typeof updates === 'function' ? updates(msg) : updates;
        return { ...msg, ...updatesObj } as ChatMessage;
      }
      return msg;
    }));
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!isConfigured || isStreaming) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now()
    };

    addMessage(userMessage);
    setIsStreaming(true);

    // Track current assistant message for this step
    let currentAssistantMessageId: string | null = null;

    try {
      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      // Get all messages including the new user message
      const allMessages = [...messages, userMessage];
      const modelMessages = convertToModelMessages(allMessages);

      // Initialize OpenAI provider
      const openai = createOpenAICompatible({
        name: 'custom',
        baseURL: settings.baseUrl,
        apiKey: settings.apiKey,
      });

      const provider = openai(settings.model);

      // Start streaming
      const result = streamText({
        model: provider,
        messages: modelMessages,
        tools,
        system: systemPrompt,
        abortSignal: abortControllerRef.current.signal,
        stopWhen: stepCountIs(50),
        onStepFinish: (stepResult) => {
          console.log('Step finished:', stepResult);

          // Finalize current assistant message if it exists
          if (currentAssistantMessageId) {
            updateMessage(currentAssistantMessageId, {
              isStreaming: false
            });
          }

          // Tool calls and results are now handled in the streaming chunks

          // Update metadata if callback provided
          if (onUpdateMetadata && stepResult.toolCalls && stepResult.toolCalls.length > 0) {
            const toolName = stepResult.toolCalls[0].toolName;
            onUpdateMetadata('Shakespeare', `Working on ${projectName} - ${toolName}`);
          }

          // Call custom step finish handler
          if (onStepFinish) {
            onStepFinish(stepResult);
          }

          // Reset current assistant message ID for next step
          currentAssistantMessageId = null;
        }
      });

      // Stream the content step by step using fullStream
      for await (const chunk of result.fullStream) {
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        switch (chunk.type) {
          case 'text-delta': {
            // Create new assistant message if we don't have one for this step
            if (!currentAssistantMessageId) {
              currentAssistantMessageId = generateId();
              const assistantMessage: ChatMessage = {
                id: currentAssistantMessageId,
                role: 'assistant',
                content: '',
                isStreaming: true,
                timestamp: Date.now()
              };
              addMessage(assistantMessage);
              setCurrentStreamingMessageId(currentAssistantMessageId);
            }

            // Update the current message with new text
            updateMessage(currentAssistantMessageId, (prev) => {
              const currentContent = prev.content;
              if (typeof currentContent === 'string') {
                return {
                  content: currentContent + chunk.text,
                  isStreaming: true
                };
              } else {
                // If content is an array, find the last text part or add a new one
                const content = Array.isArray(currentContent) ?
                  currentContent.filter((part): part is TextPart | ToolCallPart | ToolResultPart =>
                    part.type === 'text' || part.type === 'tool-call' || part.type === 'tool-result'
                  ) : [];
                const lastPart = content[content.length - 1];
                if (lastPart && lastPart.type === 'text') {
                  lastPart.text += chunk.text;
                } else {
                  content.push({ type: 'text' as const, text: chunk.text });
                }
                return {
                  content,
                  isStreaming: true
                };
              }
            });
            break;
          }

          case 'tool-call': {
            // Create new assistant message if we don't have one for this step
            if (!currentAssistantMessageId) {
              currentAssistantMessageId = generateId();
              const assistantMessage: ChatMessage = {
                id: currentAssistantMessageId,
                role: 'assistant',
                content: '',
                isStreaming: true,
                timestamp: Date.now()
              };
              addMessage(assistantMessage);
              setCurrentStreamingMessageId(currentAssistantMessageId);
            }

            // Add tool call to current message
            updateMessage(currentAssistantMessageId, (prev) => {
              const currentContent = prev.content;
              const content: Array<TextPart | ToolCallPart | ToolResultPart> = Array.isArray(currentContent) ?
                currentContent.filter((part): part is TextPart | ToolCallPart | ToolResultPart =>
                  part.type === 'text' || part.type === 'tool-call' || part.type === 'tool-result'
                ) :
                typeof currentContent === 'string' && currentContent ? [{ type: 'text' as const, text: currentContent }] : [];

              content.push({
                type: 'tool-call' as const,
                toolCallId: chunk.toolCallId,
                toolName: chunk.toolName,
                input: chunk.input
              });

              return { content };
            });
            break;
          }

          case 'tool-result': {
            // Add tool result to current message
            if (currentAssistantMessageId) {
              updateMessage(currentAssistantMessageId, (prev) => {
                const currentContent = prev.content;
                const content: Array<TextPart | ToolCallPart | ToolResultPart> = Array.isArray(currentContent) ?
                  currentContent.filter((part): part is TextPart | ToolCallPart | ToolResultPart =>
                    part.type === 'text' || part.type === 'tool-call' || part.type === 'tool-result'
                  ) :
                  typeof currentContent === 'string' && currentContent ? [{ type: 'text' as const, text: currentContent }] : [];

                content.push({
                  type: 'tool-result' as const,
                  toolCallId: chunk.toolCallId,
                  toolName: chunk.toolName,
                  output: chunk.output
                });

                return { content };
              });
            }
            break;
          }

          case 'finish': {
            // Finalize the last assistant message
            if (currentAssistantMessageId) {
              updateMessage(currentAssistantMessageId, {
                isStreaming: false
              });
            }
            break;
          }
        }
      }

    } catch (error) {
      console.error('Streaming error:', error);

      // Handle error - create or update assistant message with error content
      if (currentAssistantMessageId) {
        updateMessage(currentAssistantMessageId, {
          content: error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.',
          isStreaming: false
        });
      } else {
        // Create error message if no assistant message exists
        const errorMessageId = generateId();
        addMessage({
          id: errorMessageId,
          role: 'assistant',
          content: error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.',
          isStreaming: false,
          timestamp: Date.now()
        });
      }
    } finally {
      setIsStreaming(false);
      setCurrentStreamingMessageId(null);
      abortControllerRef.current = null;
    }
  }, [
    isConfigured,
    isStreaming,
    messages,
    settings,
    tools,
    systemPrompt,
    projectName,
    convertToModelMessages,
    addMessage,
    updateMessage,
    onStepFinish,
    onUpdateMetadata
  ]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isStreaming,
    currentStreamingMessageId,
    sendMessage,
    stopStreaming,
    clearMessages,
    addMessage,
    updateMessage,
    isConfigured
  };
}