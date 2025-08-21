import { useState, useCallback, useRef } from 'react';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText, ModelMessage, generateId, Tool, stepCountIs } from 'ai';
import { useAISettings } from '@/hooks/useAISettings';

export interface StreamingMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: Array<{
    id: string;
    toolName: string;
    input: unknown;
  }>;
  toolResults?: Array<{
    toolCallId: string;
    toolName: string;
    output: unknown;
  }>;
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
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamingMessageId, setCurrentStreamingMessageId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { settings, isConfigured } = useAISettings();

  // Convert StreamingMessage to ModelMessage for AI SDK
  const convertToModelMessages = useCallback((streamingMessages: StreamingMessage[]): ModelMessage[] => {
    const modelMessages: ModelMessage[] = [];

    for (const msg of streamingMessages) {
      if (msg.role === 'user') {
        modelMessages.push({
          role: 'user',
          content: msg.content
        });
      } else if (msg.role === 'assistant') {
        // For assistant messages, just use text content for now
        // Tool calls will be handled by the AI SDK automatically
        if (msg.content) {
          modelMessages.push({
            role: 'assistant',
            content: msg.content
          });
        }
      }
    }

    return modelMessages;
  }, []);

  const addMessage = useCallback((message: StreamingMessage) => {
    setMessages(prev => {
      const messageMap = new Map(prev.map(m => [m.id, m]));
      messageMap.set(message.id, message);
      return Array.from(messageMap.values());
    });
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<StreamingMessage> | ((prev: StreamingMessage) => Partial<StreamingMessage>)) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === id) {
        const updatesObj = typeof updates === 'function' ? updates(msg) : updates;
        return { ...msg, ...updatesObj };
      }
      return msg;
    }));
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!isConfigured || isStreaming) return;

    // Add user message
    const userMessage: StreamingMessage = {
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

          // Handle tool calls and results
          if (stepResult.toolCalls && stepResult.toolCalls.length > 0) {
            // Update the current message with tool calls
            if (currentAssistantMessageId) {
              updateMessage(currentAssistantMessageId, {
                toolCalls: stepResult.toolCalls.map(tc => ({
                  id: tc.toolCallId,
                  toolName: tc.toolName,
                  input: tc.input
                }))
              });
            }
          }

          if (stepResult.toolResults && stepResult.toolResults.length > 0) {
            // Add tool results to the current assistant message
            if (currentAssistantMessageId) {
              updateMessage(currentAssistantMessageId, {
                toolResults: stepResult.toolResults.map(tr => ({
                  toolCallId: tr.toolCallId,
                  toolName: tr.toolName,
                  output: tr.output
                }))
              });
            }
          }

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
              const assistantMessage: StreamingMessage = {
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
            updateMessage(currentAssistantMessageId, (prev) => ({
              content: (prev.content || '') + chunk.text,
              isStreaming: true
            }));
            break;
          }

          case 'tool-call': {
            // Create new assistant message if we don't have one for this step
            if (!currentAssistantMessageId) {
              currentAssistantMessageId = generateId();
              const assistantMessage: StreamingMessage = {
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
            updateMessage(currentAssistantMessageId, (prev) => ({
              toolCalls: [
                ...(prev.toolCalls || []),
                {
                  id: chunk.toolCallId,
                  toolName: chunk.toolName,
                  input: chunk.input
                }
              ]
            }));
            break;
          }

          case 'tool-result': {
            // Add tool result to current message
            if (currentAssistantMessageId) {
              updateMessage(currentAssistantMessageId, (prev) => ({
                toolResults: [
                  ...(prev.toolResults || []),
                  {
                    toolCallId: chunk.toolCallId,
                    toolName: chunk.toolName,
                    output: chunk.output
                  }
                ]
              }));
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