import { useState, useCallback, useRef } from 'react';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, Tool } from 'ai';
import { useAISettings } from '@/hooks/useAISettings';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface UseAIChatOptions {
  projectId: string;
  projectName: string;
  tools?: Record<string, Tool>;
  systemPrompt?: string;
  onUpdateMetadata?: (title: string, description: string) => void;
}

export function useAIChat({
  projectId: _projectId,
  projectName,
  tools = {},
  systemPrompt,
  onUpdateMetadata
}: UseAIChatOptions) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { settings, isConfigured } = useAISettings();

  const addMessage = useCallback((message: AIMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!isConfigured || isLoading) return;

    // Add user message
    const userMessage: AIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now()
    };

    addMessage(userMessage);
    setIsLoading(true);

    try {
      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      // Get all messages including the new user message
      const allMessages = [...messages, userMessage];
      const modelMessages = allMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Initialize OpenAI provider
      const openai = createOpenAICompatible({
        name: 'custom',
        baseURL: settings.baseUrl,
        apiKey: settings.apiKey,
      });

      const provider = openai(settings.model);

      // Update metadata
      if (onUpdateMetadata) {
        onUpdateMetadata('Shakespeare', `Working on ${projectName}...`);
      }

      // Generate response
      const result = await generateText({
        model: provider,
        messages: modelMessages,
        tools,
        system: systemPrompt,
        abortSignal: abortControllerRef.current.signal,
      });

      // Add assistant message
      const assistantMessage: AIMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.text,
        timestamp: Date.now()
      };

      addMessage(assistantMessage);

    } catch (error) {
      console.error('AI chat error:', error);

      // Add error message
      const errorMessage: AIMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now()
      };

      addMessage(errorMessage);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [isConfigured, isLoading, addMessage, messages, settings.baseUrl, settings.apiKey, settings.model, tools, systemPrompt, onUpdateMetadata, projectName]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    stopGeneration,
    clearMessages,
    addMessage,
    isConfigured
  };
}