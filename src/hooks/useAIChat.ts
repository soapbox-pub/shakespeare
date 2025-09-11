import { useState, useEffect, useCallback } from 'react';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useSessionSubscription } from '@/hooks/useSessionSubscription';
import { useAISettings } from '@/hooks/useAISettings';
import type { SessionConfig, AIMessage } from '@/lib/SessionManager';
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

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      // Check if there's already an active session for this project
      const existingSession = sessionManager.getProjectSession(projectId);

      if (existingSession) {
        // Initialize individual state variables from existing session
        setMessages([...existingSession.messages]);
        setStreamingMessage(existingSession.streamingMessage ? { ...existingSession.streamingMessage } : undefined);
        setIsLoading(existingSession.isLoading);
        setTotalCost(existingSession.totalCost || 0);
        setLastInputTokens(existingSession.lastInputTokens || 0);
      } else {
        // Create new session
        const config: SessionConfig = {
          projectId,
          tools,
          customTools,
          systemPrompt,
          maxSteps
        };

        await sessionManager.createSession(config);

        const newSession = sessionManager.getSession(projectId);
        if (newSession) {
          // Initialize individual state variables from new session
          setMessages([...newSession.messages]);
          setStreamingMessage(newSession.streamingMessage ? { ...newSession.streamingMessage } : undefined);
          setIsLoading(newSession.isLoading);
          setTotalCost(newSession.totalCost || 0);
          setLastInputTokens(newSession.lastInputTokens || 0);
        }
      }
    };

    initSession();
  }, [sessionManager, projectId, tools, customTools, systemPrompt, maxSteps]);

  // Subscribe to atomic session events for efficient updates
  useSessionSubscription('messageAdded', (updatedProjectId: string, message: AIMessage) => {
    if (updatedProjectId === projectId) {
      setMessages(prev => [...prev, message]);
    }
  }, [projectId]);

  useSessionSubscription('streamingUpdate', (updatedProjectId: string, content: string, toolCalls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]) => {
    if (updatedProjectId === projectId) {
      setStreamingMessage({
        role: 'assistant',
        content,
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
  const sendMessage = useCallback(async (content: string, providerModel: string) => {
    await sessionManager.sendMessage(projectId, content, providerModel);
  }, [projectId, sessionManager]);

  const startGeneration = useCallback(async (providerModel: string, messagesToUse?: AIMessage[]) => {
    // If specific messages are provided, we need to update the session first
    if (messagesToUse) {
      const session = sessionManager.getSession(projectId);
      if (session) {
        // Replace session messages with provided messages
        session.messages = [...messagesToUse];

        // Update local state to match
        setMessages([...messagesToUse]);
      }
    }

    await sessionManager.startGeneration(projectId, providerModel);
  }, [projectId, sessionManager]);

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