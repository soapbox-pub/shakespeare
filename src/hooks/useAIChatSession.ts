import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useAISettings } from '@/hooks/useAISettings';
import type { SessionState, SessionConfig, AIMessage } from '@/lib/SessionManager';
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
export function useAIChatSession({
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
  const [sessionState, setSessionState] = useState<SessionState | null>(null);

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
        const mostRecent = existingSessions.sort((a, b) =>
          b.lastActivity.getTime() - a.lastActivity.getTime()
        )[0];

        setSessionId(mostRecent.id);
        setSessionState(mostRecent);

        // Get the latest session state immediately
        const currentSession = sessionManager.getSession(mostRecent.id);
        if (currentSession) {
          setSessionState(currentSession);
        }
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
          setSessionState(newSession);
        }
      }
    };

    initSession();
  }, [sessionManager, projectId, projectName, tools, customTools, systemPrompt, maxSteps, generatedSessionId]);

  // Subscribe to session updates
  useEffect(() => {
    if (!sessionId) return;

    const handleSessionUpdate = (updatedSessionId: string, state: SessionState) => {
      if (updatedSessionId === sessionId) {
        setSessionState(state);
      }
    };

    const handleMessageAdded = (updatedSessionId: string, _message: AIMessage) => {
      if (updatedSessionId === sessionId) {
        // Get fresh session state
        const session = sessionManager.getSession(sessionId);
        if (session) {
          setSessionState({ ...session });
        }
      }
    };

    const handleStreamingUpdate = (updatedSessionId: string, _content: string, _toolCalls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]) => {
      if (updatedSessionId === sessionId) {
        // Get fresh session state
        const session = sessionManager.getSession(sessionId);
        if (session) {
          setSessionState({ ...session });
        }
      }
    };

    const handleLoadingChanged = (updatedSessionId: string, isLoading: boolean) => {
      if (updatedSessionId === sessionId) {
        // Update session state immediately
        const session = sessionManager.getSession(sessionId);
        if (session) {
          setSessionState({ ...session });
        }

        if (onUpdateMetadata) {
          if (isLoading) {
            onUpdateMetadata('Shakespeare', `Working on ${projectName}...`);
          }
        }
      }
    };

    sessionManager.on('sessionUpdated', handleSessionUpdate);
    sessionManager.on('messageAdded', handleMessageAdded);
    sessionManager.on('streamingUpdate', handleStreamingUpdate);
    sessionManager.on('loadingChanged', handleLoadingChanged);

    return () => {
      sessionManager.off('sessionUpdated', handleSessionUpdate);
      sessionManager.off('messageAdded', handleMessageAdded);
      sessionManager.off('streamingUpdate', handleStreamingUpdate);
      sessionManager.off('loadingChanged', handleLoadingChanged);
    };
  }, [sessionId, sessionManager, onUpdateMetadata, projectName]);



  // Derived state
  const messages = sessionState?.messages || [];
  const streamingMessage: StreamingMessage | undefined = sessionState?.streamingMessage;
  const isLoading = sessionState?.isLoading || false;

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

        // Manually trigger session update
        sessionManager.emit('sessionUpdated', sessionId, session);
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
  }, [sessionId, sessionManager]);

  const clearMessages = useCallback(async () => {
    // Alias for startNewSession for backward compatibility
    await startNewSession();
  }, [startNewSession]);

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
    isConfigured,
    sessionId
  };
}