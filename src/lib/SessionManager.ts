import OpenAI from 'openai';
import type { JSRuntimeFS } from './JSRuntime';
import { DotAI } from './DotAI';
import { parseProviderModel } from './parseProviderModel';
import type { Tool } from './tools/Tool';
import { join } from '@std/path';

// Simple debounce utility
const debounce = <T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

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
  totalCost?: number; // Total cost in USD for this session
  lastInputTokens?: number; // Input tokens from the last AI request
}

export interface SessionManagerEvents {
  sessionCreated: (sessionId: string) => void;
  sessionUpdated: (sessionId: string, state: SessionState) => void;
  sessionDeleted: (sessionId: string) => void;
  messageAdded: (sessionId: string, message: AIMessage) => void;
  streamingUpdate: (sessionId: string, content: string, toolCalls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]) => void;
  loadingChanged: (sessionId: string, isLoading: boolean) => void;
  costUpdated: (sessionId: string, totalCost: number) => void;
  contextUsageUpdated: (sessionId: string, inputTokens: number) => void;
}

/**
 * Global session manager that handles multiple AI chat sessions running concurrently.
 * Sessions can run in the background without interruption when switching between projects.
 */
export class SessionManager {
  private sessions = new Map<string, SessionState>();
  private sessionConfigs = new Map<string, SessionConfig>();
  private listeners: Partial<Record<keyof SessionManagerEvents, Set<(...args: unknown[]) => void>>> = {};
  private fs: JSRuntimeFS;
  private aiSettings: { providers: Record<string, { baseURL: string; apiKey?: string }> };
  private getProviderModels?: () => Array<{ id: string; provider: string; contextLength?: number; pricing?: { prompt: import('decimal.js').Decimal; completion: import('decimal.js').Decimal } }>;

  // Performance constants
  private readonly MAX_SESSIONS = 50;
  private readonly MAX_SESSION_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
  private debouncedPersist = debounce(() => this.persistSessions(), 1000);
  private dotAI: DotAI;

  constructor(
    fs: JSRuntimeFS,
    aiSettings: { providers: Record<string, { baseURL: string; apiKey?: string }> },
    getProviderModels?: () => Array<{ id: string; provider: string; contextLength?: number; pricing?: { prompt: import('decimal.js').Decimal; completion: import('decimal.js').Decimal } }>
  ) {
    this.fs = fs;
    this.aiSettings = aiSettings;
    this.getProviderModels = getProviderModels;
    this.dotAI = new DotAI(fs, '/');

    // Load persisted sessions on initialization
    this.loadPersistedSessions().catch(error => {
      console.warn('Failed to load sessions during initialization:', error);
    });
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
      totalCost: 0,
      lastInputTokens: 0,
    };

    // Try to load existing history
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
  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    session?.abortController?.abort();

    this.sessions.delete(sessionId);
    this.sessionConfigs.delete(sessionId);

    await this.persistSessions();
    this.emit('sessionDeleted', sessionId);
  }

  /**
   * Delete all sessions for a project
   */
  async deleteProjectSessions(projectId: string): Promise<void> {
    await Promise.all(
      this.getProjectSessions(projectId).map(session => this.deleteSession(session.id))
    );
  }

  /**
   * Add a message to a session
   */
  async addMessage(sessionId: string, message: AIMessage): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.messages.push(message);
    session.lastActivity = new Date();

    await this.saveSessionHistory(sessionId);
    this.debouncedPersist();
    this.cleanupOldSessions();

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

    await this.addMessage(sessionId, { role: 'user', content });
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
        let usage: { prompt_tokens: number; completion_tokens: number } | undefined;
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
              if (index === undefined) continue;

              accumulatedToolCalls[index] ??= {
                id: '',
                type: 'function',
                function: { name: '', arguments: '' }
              };

              const toolCall = accumulatedToolCalls[index] as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;
              if (toolCallDelta.id) toolCall.id = toolCallDelta.id;
              if (toolCallDelta.function?.name) toolCall.function.name = toolCallDelta.function.name;
              if (toolCallDelta.function?.arguments) toolCall.function.arguments += toolCallDelta.function.arguments;
            }

            if (session.streamingMessage) {
              session.streamingMessage.tool_calls = accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined;
              this.emit('streamingUpdate', sessionId, session.streamingMessage.content, session.streamingMessage.tool_calls);
              this.emit('sessionUpdated', sessionId, session);
            }
          }

          if (chunk.choices[0]?.finish_reason) {
            finishReason = chunk.choices[0].finish_reason;
          }

          // Capture usage data if available (some providers include it in the final chunk)
          if (chunk.usage) {
            usage = {
              prompt_tokens: chunk.usage.prompt_tokens || 0,
              completion_tokens: chunk.usage.completion_tokens || 0
            };
          }
        }

        // Create final assistant message
        const assistantMessage: AIMessage = {
          role: 'assistant',
          content: accumulatedContent,
          ...(accumulatedToolCalls.length > 0 && { tool_calls: accumulatedToolCalls })
        };

        // Add final message but keep streaming message until finally block
        session.messages.push(assistantMessage);
        session.lastActivity = new Date();

        // Save and emit all updates together
        await this.saveSessionHistory(sessionId);
        this.debouncedPersist();
        this.cleanupOldSessions();

        this.emit('messageAdded', sessionId, assistantMessage);
        this.emit('sessionUpdated', sessionId, session);
        conversationMessages.push(assistantMessage);

        // Update cost if usage data is available
        if (usage) {
          this.updateSessionCost(sessionId, usage, providerModel);
        }

        // Check if we should stop
        if (finishReason === 'stop' || !accumulatedToolCalls || accumulatedToolCalls.length === 0) {
          break;
        }

        // Handle tool calls
        if (accumulatedToolCalls?.length) {
          for (const toolCall of accumulatedToolCalls) {
            if (toolCall.type !== 'function') continue;

            const functionToolCall = toolCall as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;
            const toolName = functionToolCall.function.name;
            const tool = config.customTools[toolName];

            if (!tool) {
              await this.addToolMessage(sessionId, conversationMessages, functionToolCall.id, `Tool ${toolName} not found`);
              continue;
            }

            try {
              const toolArgs = tool.inputSchema.parse(JSON.parse(functionToolCall.function.arguments));
              const content = await tool.execute(toolArgs);
              await this.addToolMessage(sessionId, conversationMessages, functionToolCall.id, content);
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              await this.addToolMessage(sessionId, conversationMessages, functionToolCall.id, `Error with tool ${toolName}: ${errorMsg}`);
            }
          }
        }
      }

    } catch (error) {
      console.error('AI generation error:', error);

      // Handle different error types
      if (error?.name === 'AbortError') return; // User cancelled

      let errorMessage = 'Sorry, I encountered an unexpected error. Please try again.';
      const errorMsg = error?.message || '';

      if (error?.name === 'TypeError' && errorMsg.includes('fetch')) {
        errorMessage = 'Network error: Unable to connect to AI service. Please check your internet connection and AI settings.';
      } else if (errorMsg.includes('API key')) {
        errorMessage = 'Authentication error: Please check your API key in AI settings.';
      } else if (errorMsg.includes('rate limit')) {
        errorMessage = 'Rate limit exceeded. Please wait a moment before trying again.';
      } else if (errorMsg) {
        errorMessage = `AI service error: ${errorMsg}`;
      }

      await this.addMessage(sessionId, { role: 'assistant', content: errorMessage });
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

    session.abortController?.abort();
    session.isLoading = false;
    session.streamingMessage = undefined;
    session.abortController = undefined;

    this.emit('loadingChanged', sessionId, false);
    this.emit('sessionUpdated', sessionId, session);
  }

  /**
   * Clean up old sessions to prevent memory bloat
   */
  private cleanupOldSessions(): void {
    const now = Date.now();

    // Delete old sessions
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity.getTime() > this.MAX_SESSION_AGE) {
        this.deleteSession(id);
      }
    }

    // Delete oldest sessions if we have too many
    if (this.sessions.size > this.MAX_SESSIONS) {
      Array.from(this.sessions.entries())
        .sort(([, a], [, b]) => a.lastActivity.getTime() - b.lastActivity.getTime())
        .slice(0, this.sessions.size - this.MAX_SESSIONS)
        .forEach(([id]) => this.deleteSession(id));
    }
  }

  /**
   * Start a new session (clear messages but keep configuration)
   */
  async startNewSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.stopGeneration(sessionId);

    session.messages = [];
    session.streamingMessage = undefined;
    session.sessionName = DotAI.generateSessionName();
    session.lastActivity = new Date();
    session.totalCost = 0;
    session.lastInputTokens = 0;

    this.debouncedPersist();
    this.emit('costUpdated', sessionId, 0);
    this.emit('contextUsageUpdated', sessionId, 0);
    this.emit('sessionUpdated', sessionId, session);
  }

  /**
   * Helper to add tool messages and update conversation
   */
  private async addToolMessage(sessionId: string, conversationMessages: AIMessage[], toolCallId: string, content: string): Promise<void> {
    const toolMessage: AIMessage = {
      role: 'tool',
      content,
      tool_call_id: toolCallId
    };

    await this.addMessage(sessionId, toolMessage);
    conversationMessages.push(toolMessage);
  }

  /**
   * Update session cost and context usage based on usage data
   */
  private updateSessionCost(sessionId: string, usage: { prompt_tokens: number; completion_tokens: number }, providerModel: string): void {
    if (!this.getProviderModels) return;

    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      const parsed = parseProviderModel(providerModel, this.aiSettings.providers);
      const modelName = parsed.model;
      const providerName = parsed.provider;

      // Find the model in provider models to get pricing and context length
      const models = this.getProviderModels();
      const model = models.find(m => m.id === modelName && m.provider === providerName);

      // Update input tokens for context usage tracking
      session.lastInputTokens = usage.prompt_tokens;
      this.emit('contextUsageUpdated', sessionId, usage.prompt_tokens);

      if (!model?.pricing) {
        this.emit('sessionUpdated', sessionId, session);
        return;
      }

      // Calculate cost for this request
      const promptCost = model.pricing.prompt.times(usage.prompt_tokens);
      const completionCost = model.pricing.completion.times(usage.completion_tokens);
      const requestCost = promptCost.add(completionCost).toNumber();

      // Update session total cost
      session.totalCost = (session.totalCost || 0) + requestCost;

      this.emit('costUpdated', sessionId, session.totalCost);
      this.emit('sessionUpdated', sessionId, session);
    } catch (error) {
      console.warn('Failed to calculate session cost:', error);
    }
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
   * Simplified event system
   */
  on<K extends keyof SessionManagerEvents>(event: K, listener: SessionManagerEvents[K]): void {
    if (!this.listeners[event]) this.listeners[event] = new Set();
    this.listeners[event]!.add(listener as (...args: unknown[]) => void);
  }

  off<K extends keyof SessionManagerEvents>(event: K, listener: SessionManagerEvents[K]): void {
    this.listeners[event]?.delete(listener as (...args: unknown[]) => void);
  }

  emit<K extends keyof SessionManagerEvents>(event: K, ...args: Parameters<SessionManagerEvents[K]>): void {
    this.listeners[event]?.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    });
  }

  /**
   * Save session states using DotAI for persistence
   */
  private async persistSessions(): Promise<void> {
    try {
      if (!this.dotAI.fs?.writeFile) return;

      const sessionData = {
        sessions: Array.from(this.sessions.entries()).map(([id, session]) => ({
          id,
          session: {
            ...session,
            isLoading: false,
            streamingMessage: undefined,
            abortController: undefined
          }
        })),
        configs: Array.from(this.sessionConfigs.entries()),
        timestamp: new Date().toISOString()
      };

      // Ensure .ai directory exists before writing
      const aiDir = join(this.dotAI.workingDir, '.ai');
      try {
        await this.dotAI.fs.mkdir(aiDir, { recursive: true });
      } catch {
        // Directory might already exist, continue
      }

      await this.dotAI.fs.writeFile(
        join(aiDir, 'sessions.json'),
        JSON.stringify(sessionData)
      );
    } catch (error) {
      console.warn('Failed to persist sessions:', error);
    }
  }

  /**
   * Load persisted sessions using DotAI
   */
  private async loadPersistedSessions(): Promise<void> {
    try {
      if (!this.dotAI.fs?.readFile) return;

      const sessionsPath = join(this.dotAI.workingDir, '.ai', 'sessions.json');

      try {
        const sessionsJson = await this.dotAI.fs.readFile(sessionsPath, 'utf8');
        const sessionData = JSON.parse(sessionsJson);

        // Restore sessions
        sessionData.sessions?.forEach(({ id, session }: { id: string; session: Omit<SessionState, 'lastActivity'> & { lastActivity: string } }) => {
          this.sessions.set(id, {
            ...session,
            lastActivity: new Date(session.lastActivity),
            totalCost: session.totalCost || 0, // Ensure totalCost is set for older sessions
            lastInputTokens: session.lastInputTokens || 0 // Ensure lastInputTokens is set for older sessions
          });
        });

        // Restore configs
        sessionData.configs?.forEach(([id, config]: [string, SessionConfig]) => {
          this.sessionConfigs.set(id, config);
        });
      } catch {
        // File doesn't exist or is invalid - start fresh
      }
    } catch (error) {
      console.warn('Failed to load sessions:', error);
    }
  }

  /**
   * Cleanup - stop all sessions and clear data
   */
  async cleanup(): Promise<void> {
    await this.persistSessions();

    this.sessions.forEach((_, sessionId) => this.stopGeneration(sessionId));

    this.sessions.clear();
    this.sessionConfigs.clear();
    this.listeners = {};
  }
}