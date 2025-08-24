import { useState, useCallback, useRef, useEffect } from 'react';
import OpenAI from 'openai';
import { useAISettings } from '@/hooks/useAISettings';
import { useFS } from '@/hooks/useFS';
import { DotAI } from '@/lib/DotAI';

// Use OpenAI's native message type
export type AIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

interface UseAIChatOptions {
  projectId: string;
  projectName: string;
  tools?: Record<string, OpenAI.Chat.Completions.ChatCompletionTool>;
  customTools?: Record<string, { execute: (args: unknown) => Promise<unknown> }>;
  systemPrompt?: string;
  onUpdateMetadata?: (title: string, description: string) => void;
}

export function useAIChat({
  projectId,
  projectName,
  tools = {},
  customTools = {},
  systemPrompt,
  onUpdateMetadata
}: UseAIChatOptions) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionName, setSessionName] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const { settings, isConfigured } = useAISettings();
  const { fs } = useFS();

  // Save message to history
  const saveMessageToHistory = useCallback(async (message: AIMessage) => {
    if (!sessionName) return;

    try {
      const dotAI = new DotAI(fs, `/projects/${projectId}`);
      await dotAI.addToHistory(sessionName, message);
    } catch (error) {
      console.warn('Failed to save message to history:', error);
    }
  }, [fs, projectId, sessionName]);

  const addMessage = useCallback((message: AIMessage) => {
    setMessages(prev => [...prev, message]);
    // Save to history asynchronously
    saveMessageToHistory(message);
  }, [saveMessageToHistory]);

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

  const sendMessage = useCallback(async (content: string) => {
    if (!isConfigured || isLoading) return;

    // Add user message
    const userMessage: AIMessage = {
      role: 'user',
      content
    };

    addMessage(userMessage);
    setIsLoading(true);

    try {
      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      // Get all messages including the new user message
      const allMessages = [...messages, userMessage];

      // Use messages directly as they're already in OpenAI format
      const modelMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = allMessages;

      // Add system message if provided
      if (systemPrompt) {
        modelMessages.unshift({
          role: 'system',
          content: systemPrompt
        });
      }

      // Initialize OpenAI client
      const openai = new OpenAI({
        baseURL: settings.baseUrl,
        apiKey: settings.apiKey,
        dangerouslyAllowBrowser: true
      });

      // Update metadata
      if (onUpdateMetadata) {
        onUpdateMetadata('Shakespeare', `Working on ${projectName}...`);
      }

      // Prepare chat completion options
      const completionOptions: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model: settings.model,
        messages: modelMessages,
        tools: tools ? Object.values(tools) : undefined,
        tool_choice: tools && Object.keys(tools).length > 0 ? 'auto' : undefined
      };

      // Generate response
      const completion = await openai.chat.completions.create(completionOptions, {
        signal: abortControllerRef.current.signal
      });

      const response = completion.choices[0];
      if (!response) {
        throw new Error('No response from AI');
      }

      const responseMessage = response.message;

      // Add assistant message
      const assistantMessage: AIMessage = {
        role: 'assistant',
        content: responseMessage.content || '',
        ...(responseMessage.tool_calls && { tool_calls: responseMessage.tool_calls })
      };

      addMessage(assistantMessage);

      // Handle tool calls if present
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        for (const toolCall of responseMessage.tool_calls) {
          if (toolCall.type !== 'function') continue;

          const toolName = toolCall.function.name;
          let toolArgs;

          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch (parseError) {
            console.error(`Failed to parse tool arguments for ${toolName}:`, parseError);

            const toolErrorMessage: AIMessage = {
              role: 'tool',
              content: `Error parsing arguments for tool ${toolName}: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
              tool_call_id: toolCall.id
            };

            addMessage(toolErrorMessage);
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
                tool_call_id: toolCall.id
              };

              addMessage(toolResultMessage);
            } catch (toolError) {
              console.error(`Tool execution error for ${toolName}:`, toolError);

              const toolErrorMessage: AIMessage = {
                role: 'tool',
                content: `Error executing tool ${toolName}: ${toolError instanceof Error ? toolError.message : 'Unknown error'}`,
                tool_call_id: toolCall.id
              };

              addMessage(toolErrorMessage);
            }
          } else {
            // Tool not found
            const toolNotFoundMessage: AIMessage = {
              role: 'tool',
              content: `Tool ${toolName} not found`,
              tool_call_id: toolCall.id
            };

            addMessage(toolNotFoundMessage);
          }
        }
      }

    } catch (error) {
      console.error('AI chat error:', error);

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
  }, [isConfigured, isLoading, addMessage, messages, settings.baseUrl, settings.apiKey, settings.model, tools, customTools, systemPrompt, onUpdateMetadata, projectName]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    // Start a new session when clearing messages
    setSessionName(DotAI.generateSessionName());
  }, []);

  const startNewSession = useCallback(() => {
    setMessages([]);
    setSessionName(DotAI.generateSessionName());
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    stopGeneration,
    clearMessages,
    startNewSession,
    addMessage,
    isConfigured
  };
}