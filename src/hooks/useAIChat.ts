import { useState, useEffect, useCallback } from 'react';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useSessionSubscription } from '@/hooks/useSessionSubscription';
import { useAISettings } from '@/hooks/useAISettings';
import type { AIMessage } from '@/lib/SessionManager';
import type OpenAI from 'openai';
import type { Tool } from '@/lib/tools/Tool';

interface UseAIChatSessionOptions {
  projectId: string;
  tools?: Record<string, OpenAI.Chat.Completions.ChatCompletionTool>;
  customTools?: Record<string, Tool<unknown>>;
  systemPrompt?: string;
  maxSteps?: number;
  onUpdateMetadata?: (title: string, description: string) => void;
}

interface StreamingMessage {
  role: 'assistant';
  content: string;
  reasoning_content?: string;
  tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
}

/**
 * Hook that provides AI chat functionality using the global session manager.
 * Sessions persist and can run in the background when switching between projects.
 */
export function useAIChat({
  projectId,
  tools = {},
  customTools = {},
  systemPrompt,
  maxSteps = 50,
  onUpdateMetadata
}: UseAIChatSessionOptions) {
  const sessionManager = useSessionManager();
  const { isConfigured } = useAISettings();

  // Split session state into individual variables for efficient updates
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [totalCost, setTotalCost] = useState<number>(0);
  const [lastInputTokens, setLastInputTokens] = useState<number>(0);

  const initSession = useCallback(async () => {
    // Load or update session
    const session = await sessionManager.loadSession(projectId, tools, customTools, systemPrompt, maxSteps);
    // Initialize individual state variables from existing session
    setMessages([...session.messages]);
    setStreamingMessage(session.streamingMessage ? { ...session.streamingMessage } : undefined);
    setIsLoading(session.isLoading);
    setTotalCost(session.totalCost || 0);
    setLastInputTokens(session.lastInputTokens || 0);
  }, [sessionManager, projectId, tools, customTools, systemPrompt, maxSteps]);

  // Initialize session
  useEffect(() => {
    initSession();
  }, [initSession]);

  // Subscribe to atomic session events for efficient updates
  useSessionSubscription('messageAdded', (updatedProjectId: string, message: AIMessage) => {
    if (updatedProjectId === projectId) {
      setMessages(prev => [...prev, message]);
      // Whenever an assistant message is added, it means streaming is done (until we get another streamingUpdate)
      if (message.role === 'assistant') {
        setStreamingMessage({
          role: 'assistant',
          content: '',
          reasoning_content: '',
        });
      }
    }
  }, [projectId]);

  useSessionSubscription('streamingUpdate', (updatedProjectId: string, content: string, reasoningContent?: string, toolCalls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]) => {
    if (updatedProjectId === projectId) {
      setStreamingMessage({
        role: 'assistant',
        content,
        reasoning_content: reasoningContent,
        tool_calls: toolCalls
      });
    }
  }, [projectId]);

  useSessionSubscription('loadingChanged', (updatedProjectId: string, loading: boolean) => {
    if (updatedProjectId === projectId) {
      setIsLoading(loading);

      // Clear streaming message when loading stops
      if (!loading) {
        setStreamingMessage(undefined);
      }

      if (onUpdateMetadata && loading) {
        onUpdateMetadata('Shakespeare', `Working on ${projectId}...`);
      }
    }
  }, [projectId, onUpdateMetadata]);

  useSessionSubscription('costUpdated', (updatedProjectId: string, cost: number) => {
    if (updatedProjectId === projectId) {
      setTotalCost(cost);
    }
  }, [projectId]);

  useSessionSubscription('contextUsageUpdated', (updatedProjectId: string, inputTokens: number) => {
    if (updatedProjectId === projectId) {
      setLastInputTokens(inputTokens);
    }
  }, [projectId]);

  // Actions
  const sendMessage = useCallback(async (content: string | Array<OpenAI.Chat.Completions.ChatCompletionContentPartText>, providerModel: string) => {
    await initSession();
    await sessionManager.sendMessage(projectId, content, providerModel);
  }, [projectId, sessionManager, initSession]);

  const startGeneration = useCallback(async (providerModel: string) => {
    await initSession();
    await sessionManager.startGeneration(projectId, providerModel);
  }, [projectId, sessionManager, initSession]);

  const stopGeneration = useCallback(() => {
    sessionManager.stopGeneration(projectId);
  }, [projectId, sessionManager]);

  const addMessage = useCallback(async (message: AIMessage) => {
    await sessionManager.addMessage(projectId, message);
  }, [projectId, sessionManager]);

  const startNewSession = useCallback(async () => {
    await sessionManager.startNewSession(projectId);

    // Reset individual state variables
    setMessages([]);
    setStreamingMessage(undefined);
    setTotalCost(0);
    setLastInputTokens(0);
  }, [projectId, sessionManager]);

  const clearMessages = useCallback(async () => {
    // Alias for startNewSession for backward compatibility
    await startNewSession();
  }, [startNewSession]);

  return {
    messages,
    streamingMessage,
    isLoading,
    totalCost,
    lastInputTokens,
    sendMessage,
    startGeneration,
    stopGeneration,
    clearMessages,
    startNewSession,
    addMessage,
    isConfigured,
    projectId
  };
}