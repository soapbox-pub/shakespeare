import { useState, useCallback, useRef, useEffect } from 'react';
import OpenAI from 'openai';
import { useAISettings } from '@/hooks/useAISettings';
import { useFS } from '@/hooks/useFS';
import { DotAI } from '@/lib/DotAI';
import { parseProviderModel } from '@/lib/parseProviderModel';

// Use OpenAI's native message type
export type AIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export interface StreamingMessage {
  role: 'assistant';
  content: string;
  tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
}

interface UseAIChatOptions {
  projectId: string;
  projectName: string;
  tools?: Record<string, OpenAI.Chat.Completions.ChatCompletionTool>;
  customTools?: Record<string, { execute: (args: unknown) => Promise<unknown> }>;
  systemPrompt?: string;
  onUpdateMetadata?: (title: string, description: string) => void;
  maxSteps?: number;
}

export function useAIChat({
  projectId,
  projectName,
  tools = {},
  customTools = {},
  systemPrompt,
  onUpdateMetadata,
  maxSteps = 50
}: UseAIChatOptions) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionName, setSessionName] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const { settings, isConfigured, addRecentlyUsedModel } = useAISettings();
  const { fs } = useFS();

  // Save all messages to history
  const saveMessagesToHistory = useCallback(async (allMessages: AIMessage[]) => {
    if (!sessionName) return;

    try {
      const dotAI = new DotAI(fs, `/projects/${projectId}`);
      await dotAI.setHistory(sessionName, allMessages);
    } catch (error) {
      console.warn('Failed to save messages to history:', error);
    }
  }, [fs, projectId, sessionName]);

  const addMessage = useCallback((message: AIMessage) => {
    setMessages(prev => {
      const newMessages = [...prev, message];
      // Save to history asynchronously with all messages
      saveMessagesToHistory(newMessages);
      return newMessages;
    });
  }, [saveMessagesToHistory]);

  const startGeneration = useCallback(async (providerModel: string) => {
    if (!isConfigured || isLoading || messages.length === 0) return;

    // Get the last message - it should be a user message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user') return;

    setIsLoading(true);

    try {
      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      // Use all existing messages
      const modelMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [...messages];

      // Add system message if provided
      if (systemPrompt) {
        modelMessages.unshift({
          role: 'system',
          content: systemPrompt
        });
      }

      // Parse provider and model
      const parsed = parseProviderModel(providerModel, settings.providers);
      const connectionConfig = parsed.connection;
      const modelName = parsed.model;

      // Initialize OpenAI client with parsed connection
      const openai = new OpenAI({
        baseURL: connectionConfig.baseURL,
        apiKey: connectionConfig.apiKey,
        dangerouslyAllowBrowser: true
      });

      // Update metadata
      if (onUpdateMetadata) {
        onUpdateMetadata('Shakespeare', `Working on ${projectName}...`);
      }

      // Keep track of current messages for this conversation
      const currentMessages = [...modelMessages];
      let stepCount = 0;

      // Main loop for handling multiple steps with tool calls
      while (stepCount < maxSteps) {
        stepCount++;
        console.log(`AI Chat Step ${stepCount}/${maxSteps}`);

        // Initialize streaming message
        setStreamingMessage({
          role: 'assistant',
          content: '',
          tool_calls: undefined
        });

        // Prepare chat completion options
        const completionOptions: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
          model: modelName,
          messages: currentMessages,
          tools: tools && Object.keys(tools).length > 0 ? Object.values(tools) : undefined,
          tool_choice: tools && Object.keys(tools).length > 0 ? 'auto' : undefined,
          stream: true
        };

        // Generate streaming response
        const stream = await openai.chat.completions.create(completionOptions, {
          signal: abortControllerRef.current.signal
        });

        let accumulatedContent = '';
        const accumulatedToolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = [];
        let finishReason: string | null = null;
        let hasRecordedModel = false;

        // Process the stream
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;

          // Track recently used model on first chunk
          if (!hasRecordedModel && providerModel) {
            addRecentlyUsedModel(providerModel);
            hasRecordedModel = true;
          }

          if (delta?.content) {
            accumulatedContent += delta.content;
            setStreamingMessage(prev => prev ? {
              ...prev,
              content: prev.content + delta.content
            } : {
              role: 'assistant',
              content: delta.content,
              tool_calls: undefined
            });
          }

          if (delta?.tool_calls) {
            for (const toolCallDelta of delta.tool_calls) {
              const index = toolCallDelta.index;
              if (index !== undefined) {
                // Initialize tool call if it doesn't exist
                if (!accumulatedToolCalls[index]) {
                  accumulatedToolCalls[index] = {
                    id: toolCallDelta.id || '',
                    type: 'function',
                    function: {
                      name: '',
                      arguments: ''
                    }
                  } as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;
                }

                // Update tool call properties
                if (toolCallDelta.id) {
                  accumulatedToolCalls[index].id = toolCallDelta.id;
                }
                if (toolCallDelta.function?.name && accumulatedToolCalls[index].type === 'function') {
                  (accumulatedToolCalls[index] as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall).function.name = toolCallDelta.function.name;
                }
                if (toolCallDelta.function?.arguments && accumulatedToolCalls[index].type === 'function') {
                  (accumulatedToolCalls[index] as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall).function.arguments += toolCallDelta.function.arguments;
                }
              }
            }

            // Update streaming message with current tool calls
            setStreamingMessage(prev => prev ? {
              ...prev,
              tool_calls: accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined
            } : {
              role: 'assistant',
              content: accumulatedContent,
              tool_calls: accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined
            });
          }

          if (chunk.choices[0]?.finish_reason) {
            finishReason = chunk.choices[0].finish_reason;
          }
        }

        // Create final assistant message
        const assistantMessage: AIMessage = {
          role: 'assistant',
          content: accumulatedContent,
          ...(accumulatedToolCalls.length > 0 && { tool_calls: accumulatedToolCalls })
        };

        // Clear streaming message and add final message
        setStreamingMessage(undefined);
        addMessage(assistantMessage);
        currentMessages.push(assistantMessage);

        // Check if we should stop (no tool calls or finish reason is "stop")
        if (finishReason === 'stop' || !accumulatedToolCalls || accumulatedToolCalls.length === 0) {
          console.log(`AI Chat completed after ${stepCount} steps. Finish reason: ${finishReason}`);
          break;
        }

        // Handle tool calls if present
        if (accumulatedToolCalls && accumulatedToolCalls.length > 0) {
          console.log(`Processing ${accumulatedToolCalls.length} tool calls in step ${stepCount}`);

          for (const toolCall of accumulatedToolCalls) {
            if (toolCall.type !== 'function') continue;

            const functionToolCall = toolCall as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;
            const toolName = functionToolCall.function.name;
            let toolArgs;

            try {
              toolArgs = JSON.parse(functionToolCall.function.arguments);
            } catch (parseError) {
              console.error(`Failed to parse tool arguments for ${toolName}:`, parseError);

              const toolErrorMessage: AIMessage = {
                role: 'tool',
                content: `Error parsing arguments for tool ${toolName}: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
                tool_call_id: functionToolCall.id
              };

              addMessage(toolErrorMessage);
              currentMessages.push(toolErrorMessage);
              continue;
            }

            // Execute tool if it exists in customTools
            if (customTools && customTools[toolName]) {
              try {
                console.log(`Executing tool: ${toolName}`, toolArgs);

                // Execute the custom tool
                const tool = customTools[toolName];
                const result = await tool.execute(toolArgs);

                // Convert result to string
                const resultString = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

                // Add tool result message
                const toolResultMessage: AIMessage = {
                  role: 'tool',
                  content: resultString,
                  tool_call_id: functionToolCall.id
                };

                addMessage(toolResultMessage);
                currentMessages.push(toolResultMessage);
              } catch (toolError) {
                console.error(`Tool execution error for ${toolName}:`, toolError);

                const toolErrorMessage: AIMessage = {
                  role: 'tool',
                  content: `Error executing tool ${toolName}: ${toolError instanceof Error ? toolError.message : 'Unknown error'}`,
                  tool_call_id: functionToolCall.id
                };

                addMessage(toolErrorMessage);
                currentMessages.push(toolErrorMessage);
              }
            } else {
              // Tool not found
              const toolNotFoundMessage: AIMessage = {
                role: 'tool',
                content: `Tool ${toolName} not found`,
                tool_call_id: functionToolCall.id
              };

              addMessage(toolNotFoundMessage);
              currentMessages.push(toolNotFoundMessage);
            }
          }
        }
      }

      // If we reached maxSteps, log a warning
      if (stepCount >= maxSteps) {
        console.warn(`AI Chat reached maximum steps (${maxSteps}). Conversation may be incomplete.`);
      }

    } catch (error) {
      console.error('AI chat error:', error);

      // Clear any streaming message on error
      setStreamingMessage(undefined);

      // Add error message
      const errorMessage: AIMessage = {
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.'
      };

      addMessage(errorMessage);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [isConfigured, isLoading, addMessage, messages, settings.providers, tools, customTools, systemPrompt, onUpdateMetadata, projectName, maxSteps, addRecentlyUsedModel]);

  // Load message history when component mounts or projectId changes
  useEffect(() => {
    const loadMessageHistory = async () => {
      try {
        const dotAI = new DotAI(fs, `/projects/${projectId}`);
        const lastSession = await dotAI.readLastSessionHistory();

        if (lastSession) {
          setMessages(lastSession.messages);
          setSessionName(lastSession.sessionName);
        } else {
          // No history to load, start fresh
          setMessages([]);
          setSessionName(DotAI.generateSessionName());
        }
      } catch (error) {
        console.warn('Failed to load message history:', error);
        // Start fresh on any error
        setMessages([]);
        setSessionName(DotAI.generateSessionName());
      }
    };

    loadMessageHistory();
  }, [projectId, fs]);

  const sendMessage = useCallback(async (content: string, providerModel: string) => {
    if (!isConfigured || isLoading) return;

    // Add user message
    const userMessage: AIMessage = {
      role: 'user',
      content
    };

    addMessage(userMessage);

    // Use setTimeout to ensure the message is added before starting generation
    setTimeout(() => {
      startGeneration(providerModel);
    }, 0);
  }, [isConfigured, isLoading, addMessage, startGeneration]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setStreamingMessage(undefined);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamingMessage(undefined);
    // Start a new session when clearing messages
    setSessionName(DotAI.generateSessionName());
  }, []);

  const startNewSession = useCallback(() => {
    setMessages([]);
    setStreamingMessage(undefined);
    setSessionName(DotAI.generateSessionName());
  }, []);

  return {
    messages,
    streamingMessage,
    isLoading,
    sendMessage,
    startGeneration,
    stopGeneration,
    clearMessages,
    startNewSession,
    addMessage,
    isConfigured
  };
}