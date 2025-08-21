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

  const updateMessage = useCallback((id: string, updates: Partial<StreamingMessage>) => {
    setMessages(prev => prev.map(msg =>
      msg.id === id ? { ...msg, ...updates } : msg
    ));
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

    // Create assistant message for streaming
    const assistantMessageId = generateId();
    const assistantMessage: StreamingMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      timestamp: Date.now()
    };

    addMessage(assistantMessage);
    setCurrentStreamingMessageId(assistantMessageId);
    setIsStreaming(true);

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

          // Handle tool calls and results
          if (stepResult.toolCalls && stepResult.toolCalls.length > 0) {
            updateMessage(assistantMessageId, {
              toolCalls: stepResult.toolCalls.map(tc => ({
                id: tc.toolCallId,
                toolName: tc.toolName,
                input: tc.input
              }))
            });
          }

          if (stepResult.toolResults && stepResult.toolResults.length > 0) {
            // Add tool results as separate message
            const toolMessage: StreamingMessage = {
              id: generateId(),
              role: 'tool',
              content: '',
              toolResults: stepResult.toolResults.map(tr => ({
                toolCallId: tr.toolCallId,
                toolName: tr.toolName,
                output: tr.output
              })),
              timestamp: Date.now()
            };
            addMessage(toolMessage);
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
        }
      });

      // Stream the text content
      let streamedContent = '';

      for await (const chunk of result.textStream) {
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        streamedContent += chunk;
        updateMessage(assistantMessageId, {
          content: streamedContent,
          isStreaming: true
        });
      }

      // Wait for the final result
      const finalResult = await result;
      const finalText = await finalResult.text;

      // Update final message
      updateMessage(assistantMessageId, {
        content: finalText,
        isStreaming: false
      });

    } catch (error) {
      console.error('Streaming error:', error);

      // Handle error - update the assistant message with error content
      updateMessage(assistantMessageId, {
        content: error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.',
        isStreaming: false
      });
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