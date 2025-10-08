import OpenAI from 'openai';
import type { JSRuntimeFS } from './JSRuntime';
import { DotAI } from './DotAI';
import { parseProviderModel } from './parseProviderModel';
import { createAIClient } from './ai-client';
import type { Tool } from './tools/Tool';
import type { NUser } from '@nostrify/react/login';
import type { AIProvider } from '@/contexts/AISettingsContext';
import { makeSystemPrompt } from './system';
import { NostrMetadata } from '@nostrify/nostrify';
import { MalformedToolCallError } from './errors/MalformedToolCallError';
import { summarizeMessages } from './summarizeMessages';

export type AIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam | {
  role: 'assistant';
  content: string;
  reasoning_content?: string;
  tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
};

export interface SessionState {
  projectId: string;
  tools: Record<string, OpenAI.Chat.Completions.ChatCompletionTool>;
  customTools: Record<string, Tool<unknown>>;
  maxSteps?: number;
  messages: AIMessage[];
  streamingMessage?: {
    role: 'assistant';
    content: string;
    reasoning_content?: string;
    tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
  };
  isLoading: boolean;
  sessionName: string;
  lastActivity: Date;
  abortController?: AbortController;
  totalCost?: number; // Total cost in USD for this session
  lastInputTokens?: number; // Input tokens from the last AI request
  lastUserMessageIndex?: number; // Index of the last user message for compression detection
  isCompressing?: boolean; // Flag to indicate compression is in progress
}

export interface SessionManagerEvents {
  sessionCreated: (projectId: string) => void;
  sessionDeleted: (projectId: string) => void;
  messageAdded: (projectId: string, message: AIMessage) => void;
  streamingUpdate: (projectId: string, content: string, reasoningContent?: string, toolCalls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]) => void;
  loadingChanged: (projectId: string, isLoading: boolean) => void;
  costUpdated: (projectId: string, totalCost: number) => void;
  contextUsageUpdated: (projectId: string, inputTokens: number) => void;
}

/**
 * Global session manager that handles AI chat sessions keyed by project ID.
 * Only one session can be active per project at once.
 */
export class SessionManager {
  private sessions = new Map<string, SessionState>();
  private listeners: Partial<Record<keyof SessionManagerEvents, Set<(...args: unknown[]) => void>>> = {};
  private fs: JSRuntimeFS;
  private aiSettings: { providers: AIProvider[] };
  private getProviderModels?: () => Array<{ id: string; provider: string; contextLength?: number; pricing?: { prompt: import('decimal.js').Decimal; completion: import('decimal.js').Decimal } }>;
  private getCurrentUser?: () => { user?: NUser; metadata?: NostrMetadata };

  constructor(
    fs: JSRuntimeFS,
    aiSettings: { providers: AIProvider[] },
    getProviderModels?: () => Array<{ id: string; provider: string; contextLength?: number; pricing?: { prompt: import('decimal.js').Decimal; completion: import('decimal.js').Decimal } }>,
    getCurrentUser?: () => { user?: NUser; metadata?: NostrMetadata },
  ) {
    this.fs = fs;
    this.aiSettings = aiSettings;
    this.getProviderModels = getProviderModels;
    this.getCurrentUser = getCurrentUser;
  }

  /**
   * Create a new session for a project
   */
  async loadSession(
    projectId: string,
    tools: Record<string, OpenAI.Chat.Completions.ChatCompletionTool>,
    customTools: Record<string, Tool<unknown>>,
    maxSteps?: number
  ): Promise<SessionState> {
    let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    let sessionName = DotAI.generateSessionName();

    // Try to load existing history
    try {
      const dotAI = new DotAI(this.fs, `/projects/${projectId}`);
      const lastSession = await dotAI.readLastSessionHistory();
      if (lastSession) {
        messages = lastSession.messages;
        sessionName = lastSession.sessionName;
      }
    } catch (error) {
      console.warn('Failed to load session history:', error);
    }

    const session = this.sessions.get(projectId) ?? {
      projectId,
      tools,
      customTools,
      maxSteps,
      isLoading: false,
      lastActivity: new Date(),
      totalCost: 0,
      lastInputTokens: 0,
      ...this.sessions.get(projectId),
      messages,
      sessionName,
    };

    // Update session configuration
    session.projectId = projectId;
    session.tools = tools;

    session.customTools = customTools;
    session.maxSteps = maxSteps;

    this.sessions.set(projectId, session);

    this.emit('sessionCreated', projectId);

    return session;
  }

  /**
   * Get a session by project ID
   */
  getSession(projectId: string): SessionState | undefined {
    return this.sessions.get(projectId);
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): SessionState[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Delete a session
   */
  async deleteSession(projectId: string): Promise<void> {
    const session = this.sessions.get(projectId);
    session?.abortController?.abort();

    this.sessions.delete(projectId);

    this.emit('sessionDeleted', projectId);
  }

  /**
   * Add a message to a session
   */
  async addMessage(projectId: string, message: AIMessage): Promise<void> {
    const session = this.sessions.get(projectId);
    if (!session) return;

    session.messages.push(message);
    session.lastActivity = new Date();

    await this.saveSessionHistory(projectId);
    this.emit('messageAdded', projectId, message);
  }

  /**
   * Send a message and start AI generation
   */
  async sendMessage(projectId: string, content: string | Array<OpenAI.Chat.Completions.ChatCompletionContentPartText>, providerModel: string): Promise<void> {
    const session = this.sessions.get(projectId);

    if (!session || session.isLoading) return;

    await this.addMessage(projectId, { role: 'user', content });
    await this.startGeneration(projectId, providerModel);
  }

  /**
   * Start AI generation for a session
   */
  async startGeneration(projectId: string, providerModel: string): Promise<void> {
    console.log('Starting AI generation for project:', projectId, 'with model:', providerModel);
    let session = this.sessions.get(projectId);

    if (!session) {
      throw new Error('Session not found');
    }
    if (session.messages.length === 0) {
      throw new Error('No messages in session');
    }

    session.isLoading = true;
    session.abortController = new AbortController();
    session.lastActivity = new Date();

    // Track the index of the last user message for compression detection
    // Find the last user message index
    for (let i = session.messages.length - 1; i >= 0; i--) {
      if (session.messages[i].role === 'user') {
        session.lastUserMessageIndex = i;
        break;
      }
    }

    this.sessions.set(projectId, session);

    this.emit('loadingChanged', projectId, true);

    try {
      // Parse provider and model
      const parsed = parseProviderModel(providerModel, this.aiSettings.providers);
      const provider = parsed.provider;
      const model = parsed.model;

      // Initialize OpenAI client
      const { user, metadata } = this.getCurrentUser?.() ?? {};
      const openai = createAIClient(provider, user);

      let stepCount = 0;
      const maxSteps = session.maxSteps || 50;
      let isFirstResponse = true; // Track if this is the first AI response in this generation

      // Main AI generation loop
      while (stepCount < maxSteps && session.isLoading) {
        session = this.sessions.get(projectId);
        if (!session) {
          throw new Error('Session not found');
        }

        stepCount++;

        // Initialize streaming message
        session.streamingMessage = {
          role: 'assistant',
          content: '',
          reasoning_content: '',
          tool_calls: undefined
        };

        const systemPrompt = await makeSystemPrompt({
          cwd: `/projects/${projectId}`,
          fs: this.fs,
          mode: "agent",
          name: "Shakespeare",
          profession: "software extraordinaire",
          tools: Object.values(session.tools),
          user,
          metadata,
        });

        // Prepare messages for AI
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = systemPrompt
          ? [{ role: 'system', content: systemPrompt }, ...session.messages]
          : session.messages;

        // Prepare completion options
        const completionOptions: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
          model,
          messages,
          tools: session.tools && Object.keys(session.tools).length > 0 ? Object.values(session.tools) : undefined,
          stream: true,
          stream_options: {
            include_usage: true,
          },
        };

        // Generate streaming response
        const stream = await openai.chat.completions.create(completionOptions, {
          signal: session.abortController?.signal
        });

        let accumulatedContent = '';
        let accumulatedReasoningContent = '';
        const accumulatedToolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = [];
        let finishReason: string | null = null;

        // Process the stream
        let usage: { prompt_tokens: number; completion_tokens: number; cost?: number } | undefined;
        for await (const chunk of stream) {
          // Check if session was cancelled
          if (!session.isLoading) break;

          const delta = chunk.choices[0]?.delta as OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta | undefined;

          if (delta?.content) {
            accumulatedContent += delta.content;
            if (session.streamingMessage) {
              session.streamingMessage.content += delta.content;
              this.emit('streamingUpdate', projectId, session.streamingMessage.content, session.streamingMessage.reasoning_content, session.streamingMessage.tool_calls);
            }
          }

          // Handle reasoning content if present (some providers may include this)
          let reasoningContent: string | undefined;
          // LiteLLM, Z.ai, etc. use 'reasoning_content'
          if (delta && 'reasoning_content' in delta && typeof delta.reasoning_content === 'string') {
            reasoningContent = delta.reasoning_content;
            // ollama uses 'reasoning'
          } else if (delta && 'reasoning' in delta && typeof delta.reasoning === 'string') {
            reasoningContent = delta.reasoning;
          }
          if (reasoningContent) {
            accumulatedReasoningContent += reasoningContent;
            if (session.streamingMessage) {
              session.streamingMessage.reasoning_content += reasoningContent;
              this.emit('streamingUpdate', projectId, session.streamingMessage.content, session.streamingMessage.reasoning_content, session.streamingMessage.tool_calls);
            }
          }

          if (delta?.tool_calls) {
            for (let i = 0; i < delta.tool_calls.length; i++) {
              const toolCallDelta = delta.tool_calls[i];
              const index = toolCallDelta.index ?? i; // Fix for Gemini models

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
              this.emit('streamingUpdate', projectId, session.streamingMessage.content, session.streamingMessage.reasoning_content, session.streamingMessage.tool_calls);
            }
          }

          if (chunk.choices[0]?.finish_reason) {
            finishReason = chunk.choices[0].finish_reason;
          }

          // Capture usage data if available (some providers include it in the final chunk)
          if (chunk.usage) {
            const cost = 'cost' in chunk.usage && typeof chunk.usage.cost === 'number'
              ? chunk.usage.cost
              : undefined;

            usage = {
              prompt_tokens: chunk.usage.prompt_tokens || 0,
              completion_tokens: chunk.usage.completion_tokens || 0,
              cost,
            };
          }
        }

        // Fix tool calls with empty arguments or names
        for (const toolCall of accumulatedToolCalls) {
          if (toolCall.type === 'function') {
            toolCall.function.arguments = toolCall.function.arguments || '{}';

            // Log and handle empty tool names (malformed AI response)
            if (!toolCall.function.name || toolCall.function.name.trim() === '') {
              console.error('Malformed tool call detected: missing function name', {
                projectId,
                providerModel,
                toolCallId: toolCall.id,
                toolCall: JSON.stringify(toolCall),
              });
            }
          }
        }

        // Create final assistant message
        const assistantMessage: AIMessage = {
          role: 'assistant',
          content: accumulatedContent,
          ...(accumulatedReasoningContent && { reasoning_content: accumulatedReasoningContent }),
          ...(accumulatedToolCalls.length > 0 && { tool_calls: accumulatedToolCalls })
        };

        // Add final message but keep streaming message until finally block
        await this.addMessage(projectId, assistantMessage);

        // Update cost if usage data is available
        if (usage) {
          this.updateSessionCost(projectId, usage, providerModel);
        }

        // Check if we should trigger compression
        // Compression happens when:
        // 1. This is the first response in this generation (isFirstResponse)
        // 2. The assistant message contains tool calls
        // 3. This is not the first user message in the session (lastUserMessageIndex > 0)
        // 4. We're not already compressing
        const currentSession = this.sessions.get(projectId);
        if (
          isFirstResponse &&
          accumulatedToolCalls.length > 0 &&
          currentSession &&
          currentSession.lastUserMessageIndex !== undefined &&
          currentSession.lastUserMessageIndex > 0 &&
          !currentSession.isCompressing
        ) {
          // Trigger compression asynchronously (don't block the generation)
          this.compressSessionContext(projectId, currentSession.lastUserMessageIndex, providerModel).catch(error => {
            console.warn('Failed to compress session context:', error);
          });
        }

        // Mark that we've processed the first response
        isFirstResponse = false;

        // Handle tool calls
        if (accumulatedToolCalls?.length) {
          for (const toolCall of accumulatedToolCalls) {
            if (toolCall.type !== 'function') continue;

            const functionToolCall = toolCall as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;
            const toolName = functionToolCall.function.name;

            // Check for missing/empty tool name (malformed AI response)
            if (!toolName || toolName.trim() === '') {
              // Add detailed technical error to tool message for debugging
              await this.addToolMessage(
                projectId,
                functionToolCall.id,
                `Error: Malformed tool call received from AI provider (missing function name). This is likely a provider-specific issue. Tool call ID: ${functionToolCall.id}`
              );

              // Throw custom error to trigger Quilly UI with user-friendly message
              throw new MalformedToolCallError(
                'The AI provider sent an incomplete response. This may be due to a network interruption or provider issue.',
                functionToolCall.id,
                providerModel
              );
            }

            const tool = session.customTools[toolName];

            if (!tool) {
              await this.addToolMessage(projectId, functionToolCall.id, `Tool "${toolName}" not found`);
              continue;
            }

            try {
              let toolArgs: unknown;
              if (tool.inputSchema) {
                toolArgs = tool.inputSchema.parse(JSON.parse(functionToolCall.function.arguments || '{}'));
              } else {
                // For tools without inputSchema, use empty object or parsed arguments as-is
                const rawArgs = functionToolCall.function.arguments;
                toolArgs = rawArgs ? JSON.parse(rawArgs) : {};
              }
              const content = await tool.execute(toolArgs);
              await this.addToolMessage(projectId, functionToolCall.id, content);
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              await this.addToolMessage(projectId, functionToolCall.id, `Error with tool ${toolName}: ${errorMsg}`);
            }
          }
        }

        // Check if we should stop
        if (finishReason === 'stop') {
          break;
        }
      }
    } catch (error) {
      console.error('AI generation error:', error);

      // Handle user cancellation
      if (error instanceof OpenAI.APIUserAbortError || error?.name === 'AbortError') {
        return; // User cancelled
      }

      // Re-throw service errors to be handled at the UI level
      throw error;
    } finally {
      const finalSession = this.sessions.get(projectId);
      if (finalSession) {
        finalSession.isLoading = false;
        finalSession.streamingMessage = undefined;
        finalSession.abortController = undefined;
      }

      this.emit('loadingChanged', projectId, false);
    }
  }

  /**
   * Stop AI generation for a session
   */
  stopGeneration(projectId: string): void {
    const session = this.sessions.get(projectId);
    if (!session) return;

    session.abortController?.abort();
    session.isLoading = false;
    session.streamingMessage = undefined;
    session.abortController = undefined;

    this.emit('loadingChanged', projectId, false);
  }

  /**
   * Start a new session (clear messages but keep configuration)
   */
  async startNewSession(projectId: string): Promise<void> {
    const session = this.sessions.get(projectId);
    if (!session) return;

    this.stopGeneration(projectId);

    session.messages = [];
    session.streamingMessage = undefined;
    session.sessionName = DotAI.generateSessionName();
    session.lastActivity = new Date();
    session.totalCost = 0;
    session.lastInputTokens = 0;

    this.emit('costUpdated', projectId, 0);
    this.emit('contextUsageUpdated', projectId, 0);
  }

  /**
   * Helper to add tool messages and update conversation
   */
  private async addToolMessage(projectId: string, toolCallId: string, content: string): Promise<void> {
    const toolMessage: AIMessage = {
      role: 'tool',
      content,
      tool_call_id: toolCallId
    };

    await this.addMessage(projectId, toolMessage);
  }

  /**
   * Update session cost and context usage based on usage data
   */
  private updateSessionCost(projectId: string, usage: { prompt_tokens: number; completion_tokens: number; cost?: number }, providerModel: string): void {
    if (!this.getProviderModels) return;

    const session = this.sessions.get(projectId);
    if (!session) return;

    // If provider gives direct cost, use it
    if (typeof usage.cost === 'number') {
      session.totalCost = (session.totalCost || 0) + usage.cost;
      this.emit('costUpdated', projectId, session.totalCost);
      return;
    }

    // Otherwise, get the cost from the models endpoint
    try {
      const parsed = parseProviderModel(providerModel, this.aiSettings.providers);
      const modelName = parsed.model;
      const provider = parsed.provider;

      // Find the model in provider models to get pricing and context length
      const models = this.getProviderModels();
      const model = models.find(m => m.id === modelName && m.provider === provider.id);

      // Update input tokens for context usage tracking
      session.lastInputTokens = usage.prompt_tokens;
      this.emit('contextUsageUpdated', projectId, usage.prompt_tokens);

      if (!model?.pricing) {
        return;
      }

      // Calculate cost for this request
      const promptCost = model.pricing.prompt.times(usage.prompt_tokens);
      const completionCost = model.pricing.completion.times(usage.completion_tokens);
      const requestCost = promptCost.add(completionCost).toNumber();

      // Update session total cost
      session.totalCost = (session.totalCost || 0) + requestCost;
      this.emit('costUpdated', projectId, session.totalCost);
    } catch (error) {
      console.warn('Failed to calculate session cost:', error);
    }
  }

  /**
   * Save session history to file
   */
  private async saveSessionHistory(projectId: string): Promise<void> {
    const session = this.sessions.get(projectId);
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
   * Compress session context by summarizing old messages
   * This happens in the background and only affects the filesystem, not the UI
   */
  private async compressSessionContext(
    projectId: string,
    lastUserMessageIndex: number,
    providerModel: string
  ): Promise<void> {
    const session = this.sessions.get(projectId);
    if (!session || session.isCompressing) return;

    // Mark as compressing to prevent duplicate compression
    session.isCompressing = true;

    try {
      // Get messages up to (but excluding) the last user message
      const messagesToSummarize = session.messages.slice(0, lastUserMessageIndex);

      if (messagesToSummarize.length === 0) {
        return; // Nothing to summarize
      }

      console.log(`Compressing ${messagesToSummarize.length} messages for project ${projectId}...`);

      // Generate summary
      const { user } = this.getCurrentUser?.() ?? {};
      const summary = await summarizeMessages(
        messagesToSummarize,
        providerModel,
        this.aiSettings,
        user
      );

      // Create a system message with the summary
      const summaryMessage: AIMessage = {
        role: 'system',
        content: `Previous conversation summary:\n\n${summary}`
      };

      // Get messages from the last user message onwards (these stay as-is)
      const recentMessages = session.messages.slice(lastUserMessageIndex);

      // Create new compressed message array: summary + recent messages
      const compressedMessages = [summaryMessage, ...recentMessages];

      // Save to filesystem only (this won't affect the UI until reload)
      const dotAI = new DotAI(this.fs, `/projects/${projectId}`);
      await dotAI.setHistory(session.sessionName, compressedMessages);

      console.log(`Successfully compressed session context for project ${projectId}. Reduced from ${messagesToSummarize.length} to 1 summary message.`);
    } catch (error) {
      console.error('Failed to compress session context:', error);
    } finally {
      // Clear compression flag
      if (session) {
        session.isCompressing = false;
      }
    }
  }

  /**
   * Cleanup - stop all sessions and clear data
   */
  async cleanup(): Promise<void> {
    this.sessions.forEach((_, projectId) => this.stopGeneration(projectId));

    this.sessions.clear();
    this.listeners = {};
  }
}