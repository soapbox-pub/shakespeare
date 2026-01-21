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
  maxSteps?: number;
  onUpdateMetadata?: (title: string, description: string) => void;
  onAIError?: (error: Error) => void;
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
  maxSteps = 50,
  onUpdateMetadata,
  onAIError
}: UseAIChatSessionOptions) {
  const sessionManager = useSessionManager();
  const { isConfigured } = useAISettings();

  // Split session state into individual variables for efficient updates
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [totalCost, setTotalCost] = useState<number>(0);
  const [lastInputTokens, setLastInputTokens] = useState<number>(0);
  const [lastFinishReason, setLastFinishReason] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);

  const initSession = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoadingHistory(true);
    }
    try {
      // Load or update session
      const session = await sessionManager.loadSession(projectId, tools, customTools, maxSteps);
      // Initialize individual state variables from existing session
      setMessages([...session.messages]);
      setStreamingMessage(session.streamingMessage ? { ...session.streamingMessage } : undefined);
      setIsLoading(session.isLoading);
      setTotalCost(session.totalCost || 0);
      setLastInputTokens(session.lastInputTokens || 0);
      setLastFinishReason(session.lastFinishReason ?? null);
    } finally {
      if (showLoading) {
        setIsLoadingHistory(false);
      }
    }
  }, [sessionManager, projectId, tools, customTools, maxSteps]);

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
        setStreamingMessage(undefined);
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

  useSessionSubscription('finishReasonChanged', (updatedProjectId: string, finishReason: string | null) => {
    if (updatedProjectId === projectId) {
      setLastFinishReason(finishReason);
    }
  }, [projectId]);

  // Actions
  const sendMessage = useCallback(async (
    content: string | Array<OpenAI.Chat.Completions.ChatCompletionContentPartText | OpenAI.Chat.Completions.ChatCompletionContentPartImage>,
    providerModel: string
  ) => {
    try {
      // Ensure session is loaded (without showing loading state)
      await initSession(false);
      await sessionManager.sendMessage(projectId, content, providerModel);
    } catch (error) {
      if (onAIError && error instanceof Error) {
        onAIError(error);
      } else {
        console.error('AI chat error:', error);
      }
    }
  }, [projectId, sessionManager, initSession, onAIError]);

  const startGeneration = useCallback(async (providerModel: string) => {
    try {
      // Ensure session is loaded (without showing loading state)
      await initSession(false);
      await sessionManager.startGeneration(projectId, providerModel);
    } catch (error) {
      if (onAIError && error instanceof Error) {
        onAIError(error);
      } else {
        console.error('AI chat error:', error);
      }
    }
  }, [projectId, sessionManager, initSession, onAIError]);

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
    setLastFinishReason(null);
  }, [projectId, sessionManager]);

  const clearMessages = useCallback(async () => {
    // Alias for startNewSession for backward compatibility
    await startNewSession();
  }, [startNewSession]);

  return {
    messages,
    streamingMessage,
    isLoading,
    isLoadingHistory,
    totalCost,
    lastInputTokens,
    lastFinishReason,
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