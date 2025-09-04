import OpenAI from 'openai';
import type { JSRuntimeFS } from './JSRuntime';
import { DotAI } from './DotAI';
import { parseProviderModel } from './parseProviderModel';
import type { Tool } from './tools/Tool';

export type AIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export interface SessionConfig {
  id: string;
  projectId: string;
  projectName: string;
  tools: Record<string, OpenAI.Chat.Completions.ChatCompletionTool>;
  customTools: Record<string, Tool<unknown>>;
  systemPrompt?: string;
  maxSteps?: number;
}

export interface SessionState {
  id: string;
  projectId: string;
  projectName: string;
  messages: AIMessage[];
  streamingMessage?: {
    role: 'assistant';
    content: string;
    tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
  };
  isLoading: boolean;
  sessionName: string;
  lastActivity: Date;
  abortController?: AbortController;
}

export interface SessionManagerEvents {
  sessionCreated: (sessionId: string) => void;
  sessionUpdated: (sessionId: string, state: SessionState) => void;
  sessionDeleted: (sessionId: string) => void;
  messageAdded: (sessionId: string, message: AIMessage) => void;
  streamingUpdate: (sessionId: string, content: string, toolCalls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]) => void;
  loadingChanged: (sessionId: string, isLoading: boolean) => void;
}

type EventListener<T extends unknown[]> = (...args: T) => void;

/**
 * Global session manager that handles multiple AI chat sessions running concurrently.
 * Sessions can run in the background without interruption when switching between projects.
 */
export class SessionManager {
  private sessions = new Map<string, SessionState>();
  private sessionConfigs = new Map<string, SessionConfig>();
  private listeners = new Map<keyof SessionManagerEvents, Set<EventListener<unknown[]>>>();
  private fs: JSRuntimeFS;
  private aiSettings: {
    providers: Record<string, { baseURL: string; apiKey?: string }>;
  };

  constructor(fs: JSRuntimeFS, aiSettings: { providers: Record<string, { baseURL: string; apiKey?: string }> }) {
    this.fs = fs;
    this.aiSettings = aiSettings;

    // Load persisted sessions on initialization
    this.loadPersistedSessions();
  }

  /**
   * Create a new session for a project
   */
  async createSession(config: SessionConfig): Promise<string> {
    const sessionState: SessionState = {
      id: config.id,
      projectId: config.projectId,
      projectName: config.projectName,
      messages: [],
      isLoading: false,
      sessionName: DotAI.generateSessionName(),
      lastActivity: new Date(),
    };

    // Try to load existing history for this project
    try {
      const dotAI = new DotAI(this.fs, `/projects/${config.projectId}`);
      const lastSession = await dotAI.readLastSessionHistory();

      if (lastSession) {
        sessionState.messages = lastSession.messages;
        sessionState.sessionName = lastSession.sessionName;
      }
    } catch (error) {
      console.warn('Failed to load session history:', error);
    }

    this.sessions.set(config.id, sessionState);
    this.sessionConfigs.set(config.id, config);

    this.persistSessions();

    this.emit('sessionCreated', config.id);
    this.emit('sessionUpdated', config.id, sessionState);

    return config.id;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): SessionState[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get sessions for a specific project
   */
  getProjectSessions(projectId: string): SessionState[] {
    return Array.from(this.sessions.values()).filter(
      session => session.projectId === projectId
    );
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session?.abortController) {
      session.abortController.abort();
    }

    this.sessions.delete(sessionId);
    this.sessionConfigs.delete(sessionId);

    this.persistSessions();

    this.emit('sessionDeleted', sessionId);
  }

  /**
   * Delete all sessions for a project
   */
  deleteProjectSessions(projectId: string): void {
    const projectSessions = this.getProjectSessions(projectId);
    projectSessions.forEach(session => {
      this.deleteSession(session.id);
    });
  }

  /**
   * Add a message to a session
   */
  async addMessage(sessionId: string, message: AIMessage): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.messages.push(message);
    session.lastActivity = new Date();

    // Save to history
    await this.saveSessionHistory(sessionId);

    this.persistSessions();

    this.emit('messageAdded', sessionId, message);
    this.emit('sessionUpdated', sessionId, session);
  }

  /**
   * Send a message and start AI generation
   */
  async sendMessage(sessionId: string, content: string, providerModel: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    const config = this.sessionConfigs.get(sessionId);

    if (!session || !config || session.isLoading) return;

    // Add user message
    const userMessage: AIMessage = {
      role: 'user',
      content
    };

    await this.addMessage(sessionId, userMessage);

    // Start AI generation
    await this.startGeneration(sessionId, providerModel);
  }

  /**
   * Start AI generation for a session
   */
  async startGeneration(sessionId: string, providerModel: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    const config = this.sessionConfigs.get(sessionId);

    if (!session || !config || session.isLoading || session.messages.length === 0) return;

    // Check if last message is from user
    const lastMessage = session.messages[session.messages.length - 1];
    if (lastMessage.role !== 'user') return;

    session.isLoading = true;
    session.abortController = new AbortController();
    session.lastActivity = new Date();

    this.emit('loadingChanged', sessionId, true);
    this.emit('sessionUpdated', sessionId, session);

    try {
      // Parse provider and model
      const parsed = parseProviderModel(providerModel, this.aiSettings.providers);
      const connectionConfig = parsed.connection;
      const modelName = parsed.model;

      // Initialize OpenAI client
      const openai = new OpenAI({
        baseURL: connectionConfig.baseURL,
        apiKey: connectionConfig.apiKey,
        dangerouslyAllowBrowser: true
      });

      // Prepare messages for AI
      const modelMessages: AIMessage[] = [...session.messages];
      if (config.systemPrompt) {
        modelMessages.unshift({
          role: 'system',
          content: config.systemPrompt
        });
      }

      const conversationMessages = [...modelMessages];
      let stepCount = 0;
      const maxSteps = config.maxSteps || 50;

      // Main AI generation loop
      while (stepCount < maxSteps && session.isLoading) {
        stepCount++;

        // Initialize streaming message
        session.streamingMessage = {
          role: 'assistant',
          content: '',
          tool_calls: undefined
        };

        this.emit('sessionUpdated', sessionId, session);

        // Prepare completion options
        const completionOptions: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
          model: modelName,
          messages: conversationMessages,
          tools: config.tools && Object.keys(config.tools).length > 0 ? Object.values(config.tools) : undefined,
          tool_choice: config.tools && Object.keys(config.tools).length > 0 ? 'auto' : undefined,
          stream: true
        };

        // Generate streaming response
        const stream = await openai.chat.completions.create(completionOptions, {
          signal: session.abortController?.signal
        });

        let accumulatedContent = '';
        const accumulatedToolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = [];
        let finishReason: string | null = null;

        // Process the stream
        for await (const chunk of stream) {
          // Check if session was cancelled
          if (!session.isLoading) break;

          const delta = chunk.choices[0]?.delta;

          if (delta?.content) {
            accumulatedContent += delta.content;
            if (session.streamingMessage) {
              session.streamingMessage.content += delta.content;
              this.emit('streamingUpdate', sessionId, session.streamingMessage.content, session.streamingMessage.tool_calls);
              this.emit('sessionUpdated', sessionId, session);
            }
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

            // Update streaming message with tool calls
            if (session.streamingMessage) {
              session.streamingMessage.tool_calls = accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined;
              this.emit('streamingUpdate', sessionId, session.streamingMessage.content, session.streamingMessage.tool_calls);
              this.emit('sessionUpdated', sessionId, session);
            }
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
        session.streamingMessage = undefined;
        await this.addMessage(sessionId, assistantMessage);
        conversationMessages.push(assistantMessage);

        // Check if we should stop
        if (finishReason === 'stop' || !accumulatedToolCalls || accumulatedToolCalls.length === 0) {
          break;
        }

        // Handle tool calls
        if (accumulatedToolCalls && accumulatedToolCalls.length > 0) {
          for (const toolCall of accumulatedToolCalls) {
            if (toolCall.type !== 'function') continue;

            const functionToolCall = toolCall as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;
            const toolName = functionToolCall.function.name;
            const tool = config.customTools[toolName];

            if (!tool) {
              const toolNotFoundMessage: AIMessage = {
                role: 'tool',
                content: `Tool ${toolName} not found`,
                tool_call_id: functionToolCall.id
              };

              await this.addMessage(sessionId, toolNotFoundMessage);
              conversationMessages.push(toolNotFoundMessage);
              continue;
            }

            let toolArgs: unknown;
            try {
              const json = JSON.parse(functionToolCall.function.arguments);
              toolArgs = tool.inputSchema.parse(json);
            } catch (parseError) {
              const toolErrorMessage: AIMessage = {
                role: 'tool',
                content: `Error parsing arguments for tool ${toolName}: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
                tool_call_id: functionToolCall.id
              };

              await this.addMessage(sessionId, toolErrorMessage);
              conversationMessages.push(toolErrorMessage);
              continue;
            }

            try {
              // Execute the tool
              const content = await tool.execute(toolArgs);

              const toolResultMessage: AIMessage = {
                role: 'tool',
                content,
                tool_call_id: functionToolCall.id
              };

              await this.addMessage(sessionId, toolResultMessage);
              conversationMessages.push(toolResultMessage);
            } catch (toolError) {
              const toolErrorMessage: AIMessage = {
                role: 'tool',
                content: `Error executing tool ${toolName}: ${toolError instanceof Error ? toolError.message : 'Unknown error'}`,
                tool_call_id: functionToolCall.id
              };

              await this.addMessage(sessionId, toolErrorMessage);
              conversationMessages.push(toolErrorMessage);
            }
          }
        }
      }

    } catch (error) {
      console.error('AI generation error:', error);

      // Add error message
      const errorMessage: AIMessage = {
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.'
      };

      await this.addMessage(sessionId, errorMessage);
    } finally {
      session.isLoading = false;
      session.streamingMessage = undefined;
      session.abortController = undefined;

      this.emit('loadingChanged', sessionId, false);
      this.emit('sessionUpdated', sessionId, session);
    }
  }

  /**
   * Stop AI generation for a session
   */
  stopGeneration(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.abortController) {
      session.abortController.abort();
    }

    session.isLoading = false;
    session.streamingMessage = undefined;
    session.abortController = undefined;

    this.emit('loadingChanged', sessionId, false);
    this.emit('sessionUpdated', sessionId, session);
  }

  /**
   * Start a new session (clear messages but keep configuration)
   */
  async startNewSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Stop any ongoing generation
    this.stopGeneration(sessionId);

    // Clear messages and start fresh
    session.messages = [];
    session.streamingMessage = undefined;
    session.sessionName = DotAI.generateSessionName();
    session.lastActivity = new Date();

    this.persistSessions();

    this.emit('sessionUpdated', sessionId, session);
  }

  /**
   * Save session history to file
   */
  private async saveSessionHistory(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      const dotAI = new DotAI(this.fs, `/projects/${session.projectId}`);
      await dotAI.setHistory(session.sessionName, session.messages);
    } catch (error) {
      console.warn('Failed to save session history:', error);
    }
  }

  /**
   * Event listener management
   */
  on<K extends keyof SessionManagerEvents>(event: K, listener: SessionManagerEvents[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as EventListener<unknown[]>);
  }

  off<K extends keyof SessionManagerEvents>(event: K, listener: SessionManagerEvents[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener as EventListener<unknown[]>);
    }
  }

  emit<K extends keyof SessionManagerEvents>(event: K, ...args: Parameters<SessionManagerEvents[K]>): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          (listener as (...args: Parameters<SessionManagerEvents[K]>) => void)(...args);
        } catch (error) {
          console.error('Error in session manager event listener:', error);
        }
      });
    }
  }

  /**
   * Save session states to localStorage for persistence
   */
  private persistSessions(): void {
    try {
      const sessionData = {
        sessions: Array.from(this.sessions.entries()).map(([id, session]) => ({
          id,
          session: {
            ...session,
            // Don't persist runtime state
            isLoading: false,
            streamingMessage: undefined,
            abortController: undefined
          }
        })),
        configs: Array.from(this.sessionConfigs.entries())
      };

      localStorage.setItem('shakespeare:sessions', JSON.stringify(sessionData));
    } catch (error) {
      console.warn('Failed to persist sessions:', error);
    }
  }

  /**
   * Load persisted sessions from localStorage
   */
  private loadPersistedSessions(): void {
    try {
      const data = localStorage.getItem('shakespeare:sessions');
      if (!data) return;

      const sessionData = JSON.parse(data);

      // Restore sessions
      if (sessionData.sessions) {
        sessionData.sessions.forEach(({ id, session }: { id: string; session: Omit<SessionState, 'lastActivity'> & { lastActivity: string } }) => {
          // Convert lastActivity back to Date object
          const restoredSession: SessionState = {
            ...session,
            lastActivity: new Date(session.lastActivity)
          };
          this.sessions.set(id, restoredSession);
        });
      }

      // Restore configs
      if (sessionData.configs) {
        sessionData.configs.forEach(([id, config]: [string, SessionConfig]) => {
          this.sessionConfigs.set(id, config);
        });
      }
    } catch (error) {
      console.warn('Failed to load persisted sessions:', error);
    }
  }

  /**
   * Cleanup - stop all sessions and clear data
   */
  cleanup(): void {
    // Save sessions before cleanup
    this.persistSessions();

    // Stop all active sessions
    this.sessions.forEach((session, sessionId) => {
      this.stopGeneration(sessionId);
    });

    // Clear all data
    this.sessions.clear();
    this.sessionConfigs.clear();
    this.listeners.clear();
  }
}