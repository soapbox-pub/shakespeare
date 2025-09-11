import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useSessionSubscription } from '@/hooks/useSessionSubscription';
import { useAISettings } from '@/hooks/useAISettings';
import type { SessionConfig, AIMessage } from '@/lib/SessionManager';
import type OpenAI from 'openai';
import type { Tool } from '@/lib/tools/Tool';

interface UseAIChatSessionOptions {
  projectId: string;
  projectName: string;
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
  projectName,
  tools = {},
  customTools = {},
  systemPrompt,
  maxSteps = 50,
  onUpdateMetadata
}: UseAIChatSessionOptions) {
  const sessionManager = useSessionManager();
  const { isConfigured } = useAISettings();
  const [sessionId, setSessionId] = useState<string>('');

  // Split session state into individual variables for efficient updates
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [totalCost, setTotalCost] = useState<number>(0);
  const [lastInputTokens, setLastInputTokens] = useState<number>(0);

  // Generate consistent session ID for this project
  const generatedSessionId = useMemo(() => {
    return `session-${projectId}`;
  }, [projectId]);

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      // Check if there's already an active session for this project
      const existingSessions = sessionManager.getProjectSessions(projectId);

      if (existingSessions.length > 0) {
        // Use the most recent session for this project
        const mostRecent = existingSessions
          .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())[0];

        setSessionId(mostRecent.id);

        // Initialize individual state variables from existing session
        setMessages([...mostRecent.messages]);
        setStreamingMessage(mostRecent.streamingMessage ? { ...mostRecent.streamingMessage } : undefined);
        setIsLoading(mostRecent.isLoading);
        setTotalCost(mostRecent.totalCost || 0);
        setLastInputTokens(mostRecent.lastInputTokens || 0);
      } else {
        // Create new session
        const config: SessionConfig = {
          id: generatedSessionId,
          projectId,
          projectName,
          tools,
          customTools,
          systemPrompt,
          maxSteps
        };

        const newSessionId = await sessionManager.createSession(config);
        setSessionId(newSessionId);

        const newSession = sessionManager.getSession(newSessionId);
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
  }, [sessionManager, projectId, projectName, tools, customTools, systemPrompt, maxSteps, generatedSessionId]);

  // Subscribe to atomic session events for efficient updates
  useSessionSubscription('messageAdded', (updatedSessionId: string, message: AIMessage) => {
    if (updatedSessionId === sessionId) {
      setMessages(prev => [...prev, message]);
    }
  }, [sessionId]);

  useSessionSubscription('streamingUpdate', (updatedSessionId: string, content: string, toolCalls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]) => {
    if (updatedSessionId === sessionId) {
      setStreamingMessage({
        role: 'assistant',
        content,
        tool_calls: toolCalls
      });
    }
  }, [sessionId]);

  useSessionSubscription('loadingChanged', (updatedSessionId: string, loading: boolean) => {
    if (updatedSessionId === sessionId) {
      setIsLoading(loading);

      // Clear streaming message when loading stops
      if (!loading) {
        setStreamingMessage(undefined);
      }

      if (onUpdateMetadata && loading) {
        onUpdateMetadata('Shakespeare', `Working on ${projectName}...`);
      }
    }
  }, [sessionId, onUpdateMetadata, projectName]);

  useSessionSubscription('costUpdated', (updatedSessionId: string, cost: number) => {
    if (updatedSessionId === sessionId) {
      setTotalCost(cost);
    }
  }, [sessionId]);

  useSessionSubscription('contextUsageUpdated', (updatedSessionId: string, inputTokens: number) => {
    if (updatedSessionId === sessionId) {
      setLastInputTokens(inputTokens);
    }
  }, [sessionId]);



  // Actions
  const sendMessage = useCallback(async (content: string, providerModel: string) => {
    if (!sessionId) return;
    await sessionManager.sendMessage(sessionId, content, providerModel);
  }, [sessionId, sessionManager]);

  const startGeneration = useCallback(async (providerModel: string, messagesToUse?: AIMessage[]) => {
    if (!sessionId) return;

    // If specific messages are provided, we need to update the session first
    if (messagesToUse) {
      const session = sessionManager.getSession(sessionId);
      if (session) {
        // Replace session messages with provided messages
        session.messages = [...messagesToUse];

        // Update local state to match
        setMessages([...messagesToUse]);
      }
    }

    await sessionManager.startGeneration(sessionId, providerModel);
  }, [sessionId, sessionManager]);

  const stopGeneration = useCallback(() => {
    if (!sessionId) return;
    sessionManager.stopGeneration(sessionId);
  }, [sessionId, sessionManager]);

  const addMessage = useCallback(async (message: AIMessage) => {
    if (!sessionId) return;
    await sessionManager.addMessage(sessionId, message);
  }, [sessionId, sessionManager]);

  const startNewSession = useCallback(async () => {
    if (!sessionId) return;
    await sessionManager.startNewSession(sessionId);

    // Reset individual state variables
    setMessages([]);
    setStreamingMessage(undefined);
    setTotalCost(0);
    setLastInputTokens(0);
  }, [sessionId, sessionManager]);

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
    sessionId
  };
}