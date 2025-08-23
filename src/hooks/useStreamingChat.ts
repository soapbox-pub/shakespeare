import { useState, useCallback, useRef, useEffect } from 'react';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText, ModelMessage, generateId, Tool, stepCountIs } from 'ai';
import type { TextPart, ToolCallPart, ToolResultPart } from 'ai';
import { useAISettings } from '@/hooks/useAISettings';
import { useFS } from '@/hooks/useFS';
import { DotAI } from '@/lib/DotAI';

// Extend ModelMessage with additional UI state
export type ChatMessage = ModelMessage & {
  id: string;
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
  projectId,
  projectName,
  tools = {},
  systemPrompt,
  onStepFinish,
  onUpdateMetadata
}: UseStreamingChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamingMessageId, setCurrentStreamingMessageId] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState<string>('');
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { settings, isConfigured } = useAISettings();
  const { fs } = useFS();
  const dotAIRef = useRef<DotAI | null>(null);

  // Initialize DotAI for this project
  useEffect(() => {
    const initializeDotAI = async () => {
      try {
        const dotAI = new DotAI(fs, `/projects/${projectId}`);
        dotAIRef.current = dotAI;

        // Generate session name if not already set
        if (!sessionName) {
          setSessionName(DotAI.generateSessionName());
        }
      } catch (error) {
        console.warn('Failed to initialize DotAI:', error);
      }
    };

    initializeDotAI();
  }, [fs, projectId, sessionName]);

  // Load message history when project changes
  useEffect(() => {
    const loadMessageHistory = async () => {
      // Only load if we haven't loaded this project yet or if the project has changed
      if (!dotAIRef.current || loadedProjectId === projectId) return;

      // Clear messages when switching to a new project
      setMessages([]);
      setSessionName('');

      try {
        const historyDir = `/projects/${projectId}/.ai/history`;

        // Check if history directory exists
        try {
          await fs.stat(historyDir);
        } catch {
          // History directory doesn't exist, no history to load
          setLoadedProjectId(projectId);
          return;
        }

        // Get all session files
        const files = await fs.readdir(historyDir);
        const sessionFiles = files.filter(file => file.endsWith('.jsonl'));

        if (sessionFiles.length === 0) {
          setLoadedProjectId(projectId);
          return;
        }

        // Sort by filename (which includes timestamp) to get the latest session
        sessionFiles.sort();
        const latestSessionFile = sessionFiles[sessionFiles.length - 1];
        const latestSessionName = latestSessionFile.replace('.jsonl', '');

        // Load messages from the latest session
        const sessionPath = `${historyDir}/${latestSessionFile}`;
        const sessionContent = await fs.readFile(sessionPath, 'utf8');

        const loadedMessages: ChatMessage[] = [];
        const lines = sessionContent.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const messageData = JSON.parse(line);
            // Convert to ChatMessage format
            const chatMessage: ChatMessage = {
              id: generateId(),
              role: messageData.role,
              content: messageData.content,
              timestamp: Date.now()
            };
            loadedMessages.push(chatMessage);
          } catch (error) {
            console.warn('Failed to parse message from history:', error);
          }
        }

        if (loadedMessages.length > 0) {
          setMessages(loadedMessages);
          setSessionName(latestSessionName);
        }
      } catch (error) {
        console.warn('Failed to load message history:', error);
      } finally {
        setLoadedProjectId(projectId);
      }
    };

    loadMessageHistory();
  }, [fs, projectId, loadedProjectId]);

  // Save message to history
  const saveMessageToHistory = useCallback(async (message: ChatMessage) => {
    if (!dotAIRef.current || !sessionName) return;

    try {
      // Convert ChatMessage to DotAI format
      const aiMessage = {
        role: message.role,
        content: message.content
      };

      await dotAIRef.current.addToHistory(sessionName, aiMessage);
    } catch (error) {
      console.warn('Failed to save message to history:', error);
    }
  }, [sessionName]);

  // Convert ChatMessage to ModelMessage for AI SDK
  const convertToModelMessages = useCallback((chatMessages: ChatMessage[]): ModelMessage[] => {
    return chatMessages.map(({ id, isStreaming, timestamp, ...modelMessage }) => modelMessage as ModelMessage);
  }, []);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => {
      const messageMap = new Map(prev.map(m => [m.id, m]));
      messageMap.set(message.id, message);
      return Array.from(messageMap.values());
    });

    // Save to history (async, don't block UI)
    saveMessageToHistory(message);
  }, [saveMessageToHistory]);

  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage> | ((prev: ChatMessage) => Partial<ChatMessage>)) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === id) {
        const updatesObj = typeof updates === 'function' ? updates(msg) : updates;
        const updatedMessage = { ...msg, ...updatesObj } as ChatMessage;

        // Save to history when message is finalized (streaming stops)
        if (updatesObj.isStreaming === false && msg.isStreaming === true) {
          saveMessageToHistory(updatedMessage);
        }

        return updatedMessage;
      }
      return msg;
    }));
  }, [saveMessageToHistory]);

  const sendMessage = useCallback(async (content: string) => {
    if (!isConfigured || isStreaming) return;

    // Add user message
    const userMessage: ChatMessage = {
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

          // Tool calls and results are now handled in the streaming chunks

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
              const assistantMessage: ChatMessage = {
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
            updateMessage(currentAssistantMessageId, (prev) => {
              const currentContent = prev.content;
              if (typeof currentContent === 'string') {
                return {
                  content: currentContent + chunk.text,
                  isStreaming: true
                };
              } else {
                // If content is an array, find the last text part or add a new one
                const content = Array.isArray(currentContent) ?
                  currentContent.filter((part): part is TextPart | ToolCallPart | ToolResultPart =>
                    part.type === 'text' || part.type === 'tool-call' || part.type === 'tool-result'
                  ) : [];
                const lastPart = content[content.length - 1];
                if (lastPart && lastPart.type === 'text') {
                  lastPart.text += chunk.text;
                } else {
                  content.push({ type: 'text' as const, text: chunk.text });
                }
                return {
                  content,
                  isStreaming: true
                };
              }
            });
            break;
          }

          case 'tool-call': {
            // Create new assistant message if we don't have one for this step
            if (!currentAssistantMessageId) {
              currentAssistantMessageId = generateId();
              const assistantMessage: ChatMessage = {
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
            updateMessage(currentAssistantMessageId, (prev) => {
              const currentContent = prev.content;
              const content: Array<TextPart | ToolCallPart | ToolResultPart> = Array.isArray(currentContent) ?
                currentContent.filter((part): part is TextPart | ToolCallPart | ToolResultPart =>
                  part.type === 'text' || part.type === 'tool-call' || part.type === 'tool-result'
                ) :
                typeof currentContent === 'string' && currentContent ? [{ type: 'text' as const, text: currentContent }] : [];

              content.push({
                type: 'tool-call' as const,
                toolCallId: chunk.toolCallId,
                toolName: chunk.toolName,
                input: chunk.input
              });

              return { content };
            });
            break;
          }

          case 'tool-result': {
            // Add tool result to current message
            if (currentAssistantMessageId) {
              updateMessage(currentAssistantMessageId, (prev) => {
                const currentContent = prev.content;
                const content: Array<TextPart | ToolCallPart | ToolResultPart> = Array.isArray(currentContent) ?
                  currentContent.filter((part): part is TextPart | ToolCallPart | ToolResultPart =>
                    part.type === 'text' || part.type === 'tool-call' || part.type === 'tool-result'
                  ) :
                  typeof currentContent === 'string' && currentContent ? [{ type: 'text' as const, text: currentContent }] : [];

                content.push({
                  type: 'tool-result' as const,
                  toolCallId: chunk.toolCallId,
                  toolName: chunk.toolName,
                  output: chunk.output
                });

                return { content };
              });
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
    // Start a new session when clearing messages
    setSessionName(DotAI.generateSessionName());
    // Reset loaded project ID so history can be loaded again
    setLoadedProjectId(null);
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