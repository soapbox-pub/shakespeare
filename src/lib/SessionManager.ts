import OpenAI from 'openai';
import type { Decimal } from 'decimal.js';
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
import { EmptyMessageError } from './errors/EmptyMessageError';
import { isEmptyMessage } from './isEmptyMessage';
import { Git } from './git';
import type { NPool } from '@nostrify/nostrify';
import type { AppConfig } from '@/contexts/AppContext';
import { getSentryInstance } from './sentry';

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
  imagesNotSupported?: boolean; // Track if this session's model doesn't support images
  lastFinishReason?: string | null; // Last finish reason from AI generation
}

export interface SessionManagerEvents {
  sessionCreated: (projectId: string) => void;
  sessionDeleted: (projectId: string) => void;
  messageAdded: (projectId: string, message: AIMessage) => void;
  streamingUpdate: (projectId: string, content: string, reasoningContent?: string, toolCalls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]) => void;
  loadingChanged: (projectId: string, isLoading: boolean) => void;
  costUpdated: (projectId: string, totalCost: number) => void;
  contextUsageUpdated: (projectId: string, inputTokens: number) => void;
  fileChanged: (projectId: string, filePath: string) => void;
  finishReasonChanged: (projectId: string, finishReason: string | null) => void;
}

/**
 * Global session manager that handles AI chat sessions keyed by project ID.
 * Only one session can be active per project at once.
 */
export class SessionManager {
  private sessions = new Map<string, SessionState>();
  private listeners: Partial<Record<keyof SessionManagerEvents, Set<(...args: unknown[]) => void>>> = {};
  private fs: JSRuntimeFS;
  private nostr: NPool;
  private getSettings: () => { providers: AIProvider[]; imageModel?: string };
  private getConfig: () => AppConfig;
  private getDefaultConfig: () => AppConfig;
  private getProviderModels?: () => Array<{ id: string; provider: string; contextLength?: number; pricing?: { prompt: Decimal; completion: Decimal } }>;
  private getCurrentUser?: () => { user?: NUser; metadata?: NostrMetadata };

  constructor(
    fs: JSRuntimeFS,
    nostr: NPool,
    getSettings: () => { providers: AIProvider[]; imageModel?: string },
    getConfig: () => AppConfig,
    getDefaultConfig: () => AppConfig,
    getProviderModels?: () => Array<{ id: string; provider: string; contextLength?: number; pricing?: { prompt: Decimal; completion: Decimal } }>,
    getCurrentUser?: () => { user?: NUser; metadata?: NostrMetadata },
  ) {
    this.fs = fs;
    this.nostr = nostr;
    this.getSettings = getSettings;
    this.getConfig = getConfig;
    this.getDefaultConfig = getDefaultConfig;
    this.getProviderModels = getProviderModels;
    this.getCurrentUser = getCurrentUser;
  }

  private get git(): Git {
    const config = this.getConfig();
    return new Git({ fs: this.fs, nostr: this.nostr, corsProxy: config.corsProxy });
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
    let lastFinishReason: string | null | undefined;

    // Try to load existing history
    try {
      const config = this.getConfig();
      const dotAI = new DotAI(this.fs, `${config.fsPathProjects}/${projectId}`);
      const lastSession = await dotAI.readLastSessionHistory();
      if (lastSession) {
        messages = lastSession.messages;
        sessionName = lastSession.sessionName;
      }

      // Load last finish reason
      lastFinishReason = await dotAI.readFinishReason();
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
      lastFinishReason,
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
    session?.abortController?.abort('Session deleted');

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
  async sendMessage(
    projectId: string,
    content: string | Array<OpenAI.Chat.Completions.ChatCompletionContentPartText | OpenAI.Chat.Completions.ChatCompletionContentPartImage>,
    providerModel: string
  ): Promise<void> {
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
    this.sessions.set(projectId, session);

    this.emit('loadingChanged', projectId, true);

    try {
      // Get latest config and settings
      const config = this.getConfig();
      const defaultConfig = this.getDefaultConfig();
      const settings = this.getSettings();

      // Parse provider and model
      const parsed = parseProviderModel(providerModel, settings.providers);
      const provider = parsed.provider;
      const model = parsed.model;

      // Initialize OpenAI client
      const { user, metadata } = this.getCurrentUser?.() ?? {};
      const openai = createAIClient(provider, user, config.corsProxy);

      let stepCount = 0;
      const maxSteps = session.maxSteps || 50;

      // Main AI generation loop
      while (stepCount < maxSteps) {
        const currentSession = this.sessions.get(projectId);
        if (!currentSession || !currentSession.isLoading) {
          break;
        }
        session = currentSession;

        stepCount++;

        // Initialize streaming message
        session.streamingMessage = {
          role: 'assistant',
          content: '',
          reasoning_content: '',
          tool_calls: undefined
        };

        // Get repository URL if available
        let repositoryUrl: string | undefined;
        try {
          const remoteUrl = await this.git.getRemoteURL(`${config.fsPathProjects}/${projectId}`, 'origin');
          repositoryUrl = remoteUrl || undefined;
        } catch {
          // No repository URL available
        }

        // Get project template metadata if available
        let projectTemplate: { name: string; description: string; url: string } | undefined;
        try {
          const dotai = new DotAI(this.fs, `${config.fsPathProjects}/${projectId}`);
          const template = await dotai.readTemplate();
          projectTemplate = template || undefined;
        } catch {
          // Template metadata not available
        }

        // Build model and provider info objects
        const modelInfo = {
          id: model,
          fullId: providerModel,
        };

        const providerInfo = {
          id: provider.id,
          name: provider.name,
          baseURL: provider.baseURL,
        };

        const cwd = `${config.fsPathProjects}/${projectId}`;
        const commits = await this.git.log({ dir: cwd });
        const settings = this.getSettings();

        const systemPrompt = await makeSystemPrompt({
          cwd,
          fs: this.fs,
          mode: commits.length > 1 ? "agent" : "init",
          tools: Object.values(session.tools),
          config,
          defaultConfig,
          user,
          metadata,
          repositoryUrl,
          template: config.systemPrompt,
          projectTemplate,
          model: modelInfo,
          provider: providerInfo,
          imageModel: settings.imageModel,
        });

        // Helper function to filter out unsupported image formats (keep only JPG/JPEG/PNG)
        const filterSupportedImages = (msgs: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] => {
          return msgs.map(msg => {
            if (msg.role === 'user' && typeof msg.content !== 'string' && Array.isArray(msg.content)) {
              const filteredContent = msg.content.filter(part => {
                if (part.type !== 'image_url') return true;

                const imagePart = part as OpenAI.Chat.Completions.ChatCompletionContentPartImage;
                const url = imagePart.image_url.url.toLowerCase();

                // Keep only JPG/JPEG/PNG images
                // Check file extension or data URL MIME type
                return /\.(jpg|jpeg|png)(\?|$)/.test(url) ||
                       url.startsWith('data:image/jpeg') ||
                       url.startsWith('data:image/png') ||
                       url.startsWith('data:image/jpg');
              });

              return {
                ...msg,
                content: filteredContent
              };
            }
            return msg;
          });
        };

        // Helper function to strip all image_url parts but keep text parts (including VFS paths)
        const stripImageUrls = (msgs: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] => {
          return msgs.map(msg => {
            if (msg.role === 'user' && typeof msg.content !== 'string' && Array.isArray(msg.content)) {
              // Keep only text parts (this includes "Added file: <filename>" paths)
              const textParts = msg.content.filter(part => part.type === 'text');

              // If we had images, convert to string content (or empty if no text)
              if (textParts.length > 0) {
                return {
                  ...msg,
                  content: textParts,
                };
              }

              // If no text parts, return empty string
              return {
                ...msg,
                content: ''
              };
            }
            return msg;
          });
        };

        // Prepare messages for AI
        // Note: User messages with image_url content parts are valid ChatCompletionMessageParam types
        // The AIMessage type includes ChatCompletionMessageParam, so this cast is safe
        let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = (systemPrompt
          ? [{ role: 'system', content: systemPrompt }, ...session.messages]
          : session.messages) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

        // Filter out unsupported image formats (keep only JPG/JPEG/PNG for API)
        // This ensures the UI shows all image types, but API only receives supported formats
        messages = filterSupportedImages(messages);

        // If this session has already determined images aren't supported, strip them proactively
        if (session.imagesNotSupported) {
          messages = stripImageUrls(messages);
        }

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

        // Check if messages contain any images (for retry logic)
        const hasImages = messages.some(msg => {
          if (msg.role === 'user' && typeof msg.content !== 'string' && Array.isArray(msg.content)) {
            return msg.content.some(part => part.type === 'image_url');
          }
          return false;
        });

        // Generate streaming response with retry logic for models that don't support images
        let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
        let retriedWithoutImages = false;

        try {
          stream = await openai.chat.completions.create(completionOptions, {
            signal: session.abortController?.signal
          });
        } catch (error) {
          // Check if this might be an image-related error and we have images to strip
          const errorObj = error as Record<string, unknown>;
          const errorStatus = typeof errorObj?.status === 'number' ? errorObj.status : undefined;
          const isPotentialImageError = errorStatus === 400 || errorStatus === 404 || errorStatus === 500;

          if (isPotentialImageError && hasImages && !retriedWithoutImages) {
            console.warn('API call failed, retrying without image_url parts (keeping VFS paths):', error);
            retriedWithoutImages = true;

            // Strip image_url parts but keep text parts (including VFS paths)
            const messagesWithoutImages = stripImageUrls(messages);

            // Update completion options with stripped messages
            const retryOptions: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
              ...completionOptions,
              messages: messagesWithoutImages
            };

            // Retry the API call - if this succeeds, we know images were the problem
            stream = await openai.chat.completions.create(retryOptions, {
              signal: session.abortController?.signal
            });

            // SUCCESS: The retry without images worked, so this model doesn't support images
            // Mark this session as not supporting images to avoid future retries
            session.imagesNotSupported = true;
            console.log('Retry without images succeeded - marking this session as not supporting images');
          } else {
            // Re-throw if not a potential image error or already retried
            throw error;
          }
        }

        let accumulatedContent = '';
        let accumulatedReasoningContent = '';
        const accumulatedToolCalls: Map<number, OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall> = new Map();
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

              let toolCall = accumulatedToolCalls.get(index);

              if (!toolCall) {
                toolCall = {
                  id: '',
                  type: 'function',
                  function: { name: '', arguments: '' },
                };
              }

              if (toolCallDelta.id) toolCall.id = toolCallDelta.id;
              if (toolCallDelta.function?.name) toolCall.function.name = toolCallDelta.function.name;
              if (toolCallDelta.function?.arguments) toolCall.function.arguments += toolCallDelta.function.arguments;

              accumulatedToolCalls.set(index, toolCall);
            }

            if (session.streamingMessage && accumulatedToolCalls.size > 0) {
              const sortedToolCalls = [...accumulatedToolCalls.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(entry => entry[1]);

              session.streamingMessage.tool_calls = sortedToolCalls;
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
        for (const toolCall of accumulatedToolCalls.values()) {
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
          ...(accumulatedToolCalls.size > 0 && { tool_calls: [...accumulatedToolCalls.values()] })
        };

        // Check if the assistant message is empty (no content, reasoning, or tool calls)
        if (isEmptyMessage(assistantMessage) && finishReason !== 'stop') {
          console.error('Empty assistant message detected', {
            projectId,
            providerModel,
            finishReason,
          });

          throw new EmptyMessageError(
            'The AI generated an empty response. This may be due to a provider issue or model configuration problem.',
            providerModel,
          );
        }

        // Add final message but keep streaming message until finally block
        await this.addMessage(projectId, assistantMessage);

        // Update cost if usage data is available
        if (usage) {
          this.updateSessionCost(projectId, usage, providerModel);
        }

        // Handle tool calls
        if (accumulatedToolCalls?.size) {
          for (const toolCall of accumulatedToolCalls.values()) {
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
              const result = await tool.execute(toolArgs);
              await this.addToolMessage(projectId, functionToolCall.id, result.content);

              // Update session cost if tool returned a cost
              if (result.cost !== undefined) {
                const updatedSession = this.sessions.get(projectId);
                if (updatedSession) {
                  const currentCost = updatedSession.totalCost || 0;
                  updatedSession.totalCost = currentCost + result.cost;
                  this.sessions.set(projectId, updatedSession);
                  this.emit('costUpdated', projectId, updatedSession.totalCost);

                  // Accumulate tool cost to project total
                  await this.accumulateProjectCost(projectId, result.cost);
                }
              }
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              await this.addToolMessage(projectId, functionToolCall.id, `Error with tool ${toolName}: ${errorMsg}`);
            }
          }
        }

        // Update and save the finish reason
        session.lastFinishReason = finishReason;
        this.emit('finishReasonChanged', projectId, finishReason);
        await this.saveFinishReason(projectId, finishReason);

        // Check if we should stop
        if (finishReason === 'stop') {
          break;
        }
      }
    } catch (error) {
      console.error('AI generation error:', error);

      // Handle user cancellation
      if (error instanceof OpenAI.APIUserAbortError || (error instanceof Error && error.name === 'AbortError')) {
        return; // User cancelled
      }

      // Log unexpected TypeErrors to Sentry for investigation
      if (error instanceof TypeError) {
        getSentryInstance()?.captureException(error);
      }

      // Re-throw service errors to be handled at the UI level
      throw error;
    } finally {
      if (session) {
        session.isLoading = false;
        session.streamingMessage = undefined;
        session.abortController = undefined;
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

    session.abortController?.abort('User stopped generation');
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
    session.lastFinishReason = null;

    this.emit('costUpdated', projectId, 0);
    this.emit('contextUsageUpdated', projectId, 0);
    this.emit('finishReasonChanged', projectId, null);
  }

  /**
   * Check if content exceeds size/line limits
   */
  private exceedsLimits(content: string): boolean {
    const MAX_SIZE_BYTES = 50 * 1024; // 50 KiB
    const MAX_LINES = 2000;

    const sizeBytes = new Blob([content]).size;
    const lineCount = content.split('\n').length;

    return sizeBytes > MAX_SIZE_BYTES || lineCount > MAX_LINES;
  }

  /**
   * Save content to tmpDir and return the file path
   */
  private async saveToTmpFile(projectId: string, content: string, toolCallId: string): Promise<string> {
    const config = this.getConfig();
    const timestamp = Date.now();
    const filename = `tool-output-${toolCallId}-${timestamp}.txt`;
    const filepath = `${config.fsPathTmp}/${filename}`;

    await this.fs.writeFile(filepath, content, 'utf8');
    return filepath;
  }

  /**
   * Helper to add tool messages and update conversation
   */
  private async addToolMessage(projectId: string, toolCallId: string, content: string): Promise<void> {
    let finalContent = content;

    // Check if content exceeds limits
    if (this.exceedsLimits(content)) {
      // Save full content to tmp file
      const filepath = await this.saveToTmpFile(projectId, content, toolCallId);

      // Create placeholder message
      finalContent = `The tool call succeeded but the output was truncated. Full output saved to: ${filepath}\nUse \`grep\` to search the full content or \`read\` with offset/limit to view specific sections.`;
    }

    const toolMessage: AIMessage = {
      role: 'tool',
      content: finalContent,
      tool_call_id: toolCallId
    };

    await this.addMessage(projectId, toolMessage);
  }

  /**
   * Update session cost and context usage based on usage data
   */
  private async updateSessionCost(projectId: string, usage: { prompt_tokens: number; completion_tokens: number; cost?: number }, providerModel: string): Promise<void> {
    if (!this.getProviderModels) return;

    const session = this.sessions.get(projectId);
    if (!session) return;

    // If provider gives direct cost, use it
    if (typeof usage.cost === 'number') {
      session.totalCost = (session.totalCost || 0) + usage.cost;
      this.emit('costUpdated', projectId, session.totalCost);

      // Accumulate cost to project total
      await this.accumulateProjectCost(projectId, usage.cost);
      return;
    }

    // Otherwise, get the cost from the models endpoint
    try {
      const settings = this.getSettings();
      const parsed = parseProviderModel(providerModel, settings.providers);
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

      // Accumulate cost to project total
      await this.accumulateProjectCost(projectId, requestCost);
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
      const config = this.getConfig();
      const dotAI = new DotAI(this.fs, `${config.fsPathProjects}/${session.projectId}`);
      // Cast to ChatCompletionMessageParam[] - user messages with image arrays are valid
      await dotAI.setHistory(session.sessionName, session.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[]);
    } catch (error) {
      console.warn('Failed to save session history:', error);
    }
  }

  /**
   * Save finish reason to file
   */
  private async saveFinishReason(projectId: string, finishReason: string | null): Promise<void> {
    try {
      const config = this.getConfig();
      const dotAI = new DotAI(this.fs, `${config.fsPathProjects}/${projectId}`);
      await dotAI.writeFinishReason(finishReason);
    } catch (error) {
      console.warn('Failed to save finish reason:', error);
    }
  }

  /**
   * Accumulate request cost to the project's total cost file
   */
  private async accumulateProjectCost(projectId: string, requestCost: number): Promise<void> {
    try {
      const config = this.getConfig();
      const dotAI = new DotAI(this.fs, `${config.fsPathProjects}/${projectId}`);

      // Read current project total
      const currentTotal = await dotAI.readCost();

      // Add this request's cost
      const newTotal = currentTotal + requestCost;

      // Write back the new total
      await dotAI.writeCost(newTotal);
    } catch (error) {
      console.warn('Failed to accumulate project cost:', error);
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
   * Cleanup - stop all sessions and clear data
   */
  async cleanup(): Promise<void> {
    this.sessions.forEach((_, projectId) => this.stopGeneration(projectId));

    this.sessions.clear();
    this.listeners = {};
  }
}