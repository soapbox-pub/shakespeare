import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { OnboardingDialog } from '@/components/OnboardingDialog';
import { ChevronDown, Play } from 'lucide-react';
import { useAISettings } from '@/hooks/useAISettings';
import { useFS } from '@/hooks/useFS';
import { useFSPaths } from '@/hooks/useFSPaths';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useKeepAlive } from '@/hooks/useKeepAlive';
import { useAppContext } from '@/hooks/useAppContext';
import { useAIChat } from '@/hooks/useAIChat';
import { useProviderModels } from '@/hooks/useProviderModels';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useMCPTools } from '@/hooks/useMCPTools';
import { useQueryClient } from '@tanstack/react-query';
import { AIMessageItem } from '@/components/AIMessageItem';
import { ToolCallDisplay } from '@/components/ToolCallDisplay';
import { ReadTool } from '@/lib/tools/ReadTool';
import { WriteTool } from '@/lib/tools/WriteTool';
import { EditTool } from '@/lib/tools/EditTool';
import { GlobTool } from '@/lib/tools/GlobTool';
import { GrepTool } from '@/lib/tools/GrepTool';
import { NpmAddPackageTool } from '@/lib/tools/NpmAddPackageTool';
import { NpmRemovePackageTool } from '@/lib/tools/NpmRemovePackageTool';
import { GitCommitTool } from '@/lib/tools/GitCommitTool';
import { BuildProjectTool } from '@/lib/tools/BuildProjectTool';
import { NostrReadNipTool } from '@/lib/tools/NostrReadNipTool';
import { NostrFetchEventTool } from '@/lib/tools/NostrFetchEventTool';
import { NostrReadKindTool } from '@/lib/tools/NostrReadKindTool';
import { NostrReadTagTool } from '@/lib/tools/NostrReadTagTool';
import { NostrReadProtocolTool } from '@/lib/tools/NostrReadProtocolTool';
import { NostrReadNipsIndexTool } from '@/lib/tools/NostrReadNipsIndexTool';
import { NostrGenerateKindTool } from '@/lib/tools/NostrGenerateKindTool';
import { NostrPublishEventsTool } from '@/lib/tools/NostrPublishEventsTool';
import { ShellTool } from '@/lib/tools/ShellTool';
import { ReadConsoleMessagesTool } from '@/lib/tools/ReadConsoleMessagesTool';
import { SkillTool } from '@/lib/tools/SkillTool';
import { GenerateImageTool } from '@/lib/tools/GenerateImageTool';
import { ViewAvailableModelsTool } from '@/lib/tools/ViewAvailableModelsTool';
import { ConfigureImageGenerationTool } from '@/lib/tools/ConfigureImageGenerationTool';
import { WebFetchTool } from '@/lib/tools/WebFetchTool';
import { WebSearchTool } from '@/lib/tools/WebSearchTool';
import { createMCPTools } from '@/lib/tools/MCPTool';
import { TodoWriteTool } from '@/lib/tools/TodoWriteTool';
import { TodoReadTool } from '@/lib/tools/TodoReadTool';
import { ProjectPreviewConsoleError } from '@/lib/consoleMessages';
import { toolToOpenAI } from '@/lib/tools/openai-adapter';
import { Tool } from '@/lib/tools/Tool';
import OpenAI from 'openai';
import { useGit } from '@/hooks/useGit';
import { Quilly } from '@/components/Quilly';
import { ShakespeareLogo } from '@/components/ShakespeareLogo';
import { ChatInput } from '@/components/Shakespeare/ChatInput';
import { buildMessageContent } from '@/lib/buildMessageContent';
import { DotAI } from '@/lib/DotAI';
import { parseProviderModel } from '@/lib/parseProviderModel';
import { AIMessage } from '@/lib/SessionManager';

// Clean interfaces now handled by proper hooks

interface ChatPaneProps {
  projectId: string;
  onNewChat: () => void;
  onFirstInteraction?: () => void;
  onLoadingChange?: (isLoading: boolean) => void;
  isLoading?: boolean;
  isBuildLoading?: boolean;
  consoleError?: ProjectPreviewConsoleError | null;
  onDismissConsoleError?: () => void;
}

export interface ChatPaneRef {
  startNewSession: () => void;
}

export const ChatPane = forwardRef<ChatPaneRef, ChatPaneProps>(({
  projectId,
  onNewChat,
  onFirstInteraction,
  onLoadingChange,
  isLoading: externalIsLoading,
  isBuildLoading: externalIsBuildLoading,
  consoleError,
  onDismissConsoleError,
}, ref) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { fs } = useFS();
  const { git } = useGit();
  const { user } = useCurrentUser();
  const { models } = useProviderModels();
  const { config } = useAppContext();
  const { projectsPath, tmpPath, pluginsPath } = useFSPaths();
  const queryClient = useQueryClient();
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const scrolledProjectsRef = useRef(new Set<string>());
  const shouldScrollToBottomRef = useRef(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isStuck, setIsStuck] = useState(false);
  const [aiError, setAIError] = useState<Error | null>(null);
  const [templateInfo, setTemplateInfo] = useState<{ name: string; description: string; url: string } | null>(null);
  const [showTemplateInfo, setShowTemplateInfo] = useState(false);

  // Determine which error to show - AI errors take priority over console errors
  // since they are more immediately relevant to the user's current action
  const displayError = aiError || consoleError;

  // Use external state if provided, otherwise default to false
  const isBuildLoading = externalIsBuildLoading || false;
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const aiSettings = useAISettings();
  const { isConfigured, settings, addRecentlyUsedModel, isLoading: isLoadingSettings } = aiSettings;
  const [providerModel, setProviderModel] = useState(() => {
    // Initialize with first recently used model if available, otherwise empty
    return settings.recentlyUsedModels?.[0] || '';
  });
  // State to control model selector dropdown
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [shouldAutostart, setShouldAutostart] = useState(false);
  const autostartedRef = useRef(false);

  // Memoize model selector onChange handler to prevent unnecessary re-renders
  const handleModelChange = useCallback((newModel: string) => {
    setProviderModel(newModel);
  }, []);

  useEffect(() => {
    if (!providerModel && settings.recentlyUsedModels?.length) {
      setProviderModel(settings.recentlyUsedModels[0]);
    }
  }, [providerModel, settings.recentlyUsedModels]);

  useEffect(() => {
    const urlModel = searchParams.get('model');
    const autostart = searchParams.get('autostart');

    if (urlModel && !providerModel) {
      setProviderModel(urlModel);
    }
    if (autostart === 'true') {
      setShouldAutostart(true);
    }

    // Clear the autostart and model parameters
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete('autostart');
    newSearchParams.delete('model');
    setSearchParams(newSearchParams, { replace: true });
  }, [providerModel, searchParams, setSearchParams])

  // Reset error state when navigating between projects and switching models
  useEffect(() => {
    setAIError(null);
  }, [projectId, providerModel]);

  // Initialize AI chat with tools
  const cwd = `${projectsPath}/${projectId}`;
  const esmUrlRef = useRef(config.esmUrl);
  const sessionManager = useSessionManager();

  // Callback to emit file changes for auto-build
  const handleFileChanged = useCallback((filePath: string) => {
    // Emit the fileChanged event through the session manager
    sessionManager.emit('fileChanged', projectId, filePath);
  }, [sessionManager, projectId]);

  // Callback to trigger sync after git commits
  const handleCommit = useCallback(() => {
    // Invalidate the git-sync query to trigger an immediate sync
    queryClient.invalidateQueries({ queryKey: ['git-sync', cwd] });
  }, [queryClient, cwd]);

  // Fetch MCP tools
  const { tools: mcpOpenAITools, clients: mcpClients } = useMCPTools();

  // Separate built-in tools from MCP tools for clarity
  const builtInTools = useMemo(() => {
    const tools: Record<string, Tool<unknown>> = {
      // File operation tools (OpenCode-compatible API)
      read: new ReadTool(fs, cwd, { projectsPath }),
      write: new WriteTool(fs, cwd, { projectsPath, tmpPath, onFileChanged: handleFileChanged }),
      edit: new EditTool(fs, cwd, { projectsPath, tmpPath, onFileChanged: handleFileChanged }),
      glob: new GlobTool(fs, cwd),
      grep: new GrepTool(fs, cwd),
      
      // Other tools
      git_commit: new GitCommitTool(fs, cwd, git, { onCommit: handleCommit }),
      npm_add_package: new NpmAddPackageTool(fs, cwd),
      npm_remove_package: new NpmRemovePackageTool(fs, cwd),
      build_project: new BuildProjectTool(fs, cwd, esmUrlRef.current),
      nostr_read_nip: new NostrReadNipTool(),
      nostr_fetch_event: new NostrFetchEventTool(),
      nostr_read_kind: new NostrReadKindTool(),
      nostr_read_tag: new NostrReadTagTool(),
      nostr_read_protocol: new NostrReadProtocolTool(),
      nostr_read_nips_index: new NostrReadNipsIndexTool(),
      nostr_generate_kind: new NostrGenerateKindTool(),
      nostr_publish_events: new NostrPublishEventsTool(),
      shell: new ShellTool(fs, cwd, git, config.corsProxy, user?.signer),
      read_console_messages: new ReadConsoleMessagesTool(),
      skill: new SkillTool(fs, pluginsPath, cwd),
      webfetch: new WebFetchTool({ corsProxy: config.corsProxy }),
      websearch: new WebSearchTool(),
      todowrite: new TodoWriteTool(fs, projectId, { projectsPath }),
      todoread: new TodoReadTool(fs, projectId, { projectsPath }),
    };

    // Add generate_image tool if imageModel is configured
    if (settings.imageModel) {
      try {
        const { provider, model } = parseProviderModel(settings.imageModel, settings.providers);

        // Find the model data to determine the generation mode
        const providerModel = models.find(m => m.fullId === settings.imageModel);

        // Determine mode: 'chat' if model supports image output modality, otherwise 'image'
        let mode: 'chat' | 'image' = 'image';

        if (providerModel?.type) {
          switch (providerModel.type) {
            case 'chat':
              mode = 'chat';
              break;
            case 'image':
              mode = 'image';
              break;
          }
        } else if (providerModel?.modalities?.includes('image')) {
          mode = 'chat';
        }

        tools.generate_image = new GenerateImageTool(
          fs,
          tmpPath,
          provider,
          model,
          mode,
          user,
          config.corsProxy
        );
      } catch (error) {
        console.warn('Failed to parse imageModel:', error);
      }
    } else {
      // If imageModel is not configured, provide tools to help configure it
      tools.view_available_models = new ViewAvailableModelsTool(
        models,
        settings.imageModel
      );
      tools.configure_image_generation = new ConfigureImageGenerationTool(
        aiSettings,
        models
      );
    }

    return tools;
  }, [fs, git, cwd, user, projectsPath, tmpPath, pluginsPath, config.corsProxy, settings, aiSettings, models, handleFileChanged, handleCommit, projectId]);

  // MCP tools wrapped for execution
  const mcpToolWrappers = useMemo(() => createMCPTools(mcpClients), [mcpClients]);

  // Combined tool executors (for SessionManager to call)
  const customTools = useMemo(() => ({
    ...builtInTools,
    ...mcpToolWrappers,
  }), [builtInTools, mcpToolWrappers]);

  // Convert tools to OpenAI format for AI provider
  const tools = useMemo(() => {
    const result: Record<string, OpenAI.Chat.Completions.ChatCompletionTool> = {};

    // Convert built-in tools to OpenAI format
    for (const [name, tool] of Object.entries(builtInTools)) {
      result[name] = toolToOpenAI(name, tool as Tool<unknown>);
    }

    // Add MCP tools (already in OpenAI format from useMCPTools)
    Object.assign(result, mcpOpenAITools);

    return result;
  }, [builtInTools, mcpOpenAITools]);

  // Keep-alive functionality to prevent tab throttling during AI processing
  const { updateMetadata } = useKeepAlive({
    enabled: externalIsLoading || isBuildLoading,
    title: 'Shakespeare',
    artist: `Working on ${projectId}...`,
    artwork: [
      {
        src: '/shakespeare-512x512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  });

  // Memoize the metadata update callback to avoid unnecessary re-renders
  const onUpdateMetadata = useCallback((title: string, description: string) => {
    updateMetadata(title, description);
  }, [updateMetadata]);

  // Handle AI errors from the SessionManager
  const onAIError = useCallback((error: Error) => {
    setAIError(error);
  }, []);

  const {
    messages,
    streamingMessage,
    isLoading: internalIsLoading,
    isLoadingHistory,
    totalCost,
    lastInputTokens,
    lastFinishReason,
    addMessage,
    sendMessage,
    startGeneration,
    stopGeneration,
    startNewSession: internalStartNewSession,
  } = useAIChat({
    projectId,
    tools,
    customTools,
    onUpdateMetadata,
    onAIError,
  });

  // Check if we should show the template info banner
  useEffect(() => {
    const checkTemplateInfo = async () => {
      try {
        // Only check if we have at least 1 message
        if (messages.length === 0) {
          setShowTemplateInfo(false);
          return;
        }

        const projectCwd = `${projectsPath}/${projectId}`;
        const dotAI = new DotAI(fs, projectCwd);

        // Check if template.json exists
        const template = await dotAI.readTemplate();
        if (!template) {
          setShowTemplateInfo(false);
          return;
        }

        // Check if exactly 1 history file exists
        const historyDirExists = await dotAI.historyDirExists();
        if (!historyDirExists) {
          setShowTemplateInfo(false);
          return;
        }

        const historyDir = `${projectCwd}/.git/ai/history`;
        const files = await fs.readdir(historyDir);
        const historyFiles = files.filter(file => file.endsWith('.jsonl'));

        if (historyFiles.length === 1) {
          setTemplateInfo(template);
          setShowTemplateInfo(true);
        } else {
          setShowTemplateInfo(false);
        }
      } catch (error) {
        console.warn('Failed to check template info:', error);
        setShowTemplateInfo(false);
      }
    };

    checkTemplateInfo();
  }, [fs, projectsPath, projectId, messages.length]);

  // Handle console error help requests
  const handleConsoleErrorHelp = useCallback(async () => {
    const tool = new ReadConsoleMessagesTool();
    const toolCallId = `call_${crypto.randomUUID().replace(/-/g, '')}`;

    await addMessage({
      role: 'assistant',
      content: 'Let me take a look at the console messages to help diagnose the issue.',
      tool_calls: [
        {
          id: toolCallId,
          type: 'function',
          function: {
            name: 'read_console_messages',
            arguments: '{}',
          }
        }
      ]
    });

    const result = await tool.execute({ filter: 'error' });

    await addMessage({
      role: 'tool',
      content: result.content,
      tool_call_id: toolCallId,
    });

    await startGeneration(providerModel);
  }, [addMessage, providerModel, startGeneration]);

  // Handle error dismissal
  const handleErrorDismiss = useCallback(() => {
    if (consoleError && onDismissConsoleError) {
      onDismissConsoleError();
    } else {
      setAIError(null);
    }
  }, [consoleError, onDismissConsoleError]);

  // Use external loading state if provided, otherwise use internal state
  const isLoading = externalIsLoading !== undefined ? externalIsLoading : internalIsLoading;

  // Calculate context usage percentage
  const currentModel = useMemo(() => {
    if (!providerModel.trim()) return null;
    return models.find(model => model.fullId === providerModel.trim());
  }, [models, providerModel]);

  const contextUsagePercentage = useMemo(() => {
    if (!currentModel?.contextLength || !lastInputTokens) return 0;
    return Math.min((lastInputTokens / currentModel.contextLength) * 100, 100);
  }, [currentModel, lastInputTokens]);

  // Notify parent of loading state changes
  useEffect(() => {
    if (onLoadingChange) {
      onLoadingChange(internalIsLoading);
    }
  }, [internalIsLoading, onLoadingChange]);

  // Timer to detect when AI appears stuck during tool generation
  useEffect(() => {
    // Start a 2-second timer
    const timer = streamingMessage
      ? setTimeout(() => setIsStuck(true), 2000)
      : undefined;

    return () => {
      setIsStuck(false);
      clearTimeout(timer);
    };
  }, [streamingMessage]);

  // Function to scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, []);

  // Function to open model selector dropdown
  const openModelSelector = useCallback(() => {
    setIsModelSelectorOpen(true);
  }, []);

  // Scroll to bottom when any error occurs (AI error or console error)
  useEffect(() => {
    if (displayError) {
      scrollToBottom();
    }
  }, [displayError, scrollToBottom]);

  // Check for autostart parameter and trigger AI generation
  useEffect(() => {
    if (autostartedRef.current) return;

    if (shouldAutostart && providerModel && isConfigured) {
      // Start AI generation
      addRecentlyUsedModel(providerModel);
      startGeneration(providerModel);
      autostartedRef.current = true;
    }
  }, [addRecentlyUsedModel, isConfigured, providerModel, shouldAutostart, startGeneration]);

  // Simple scroll event listener
  useEffect(() => {
    const container = scrollAreaRef.current;
    if (!container) return;

    const handleScroll = () => {
      const threshold = 100;
      const isNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - threshold;
      const hasScrollableContent = container.scrollHeight > container.clientHeight;

      setShowScrollToBottom(!isNearBottom && hasScrollableContent);
    };

    container.addEventListener('scroll', handleScroll);

    // Check immediately
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [messages]); // Re-run when messages change to ensure proper setup

  useEffect(() => {
    if (scrollAreaRef.current && (messages || streamingMessage)) {
      const threshold = 100;
      const container = scrollAreaRef.current;
      const isNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - threshold;

      // Auto-scroll if:
      // 1. User just sent a message (shouldScrollToBottomRef is true), OR
      // 2. User was already near the bottom
      if (shouldScrollToBottomRef.current || isNearBottom) {
        // Double requestAnimationFrame ensures scroll happens after layout and paint
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (scrollAreaRef.current) {
              scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
            }
          });
        });
        shouldScrollToBottomRef.current = false; // Reset the flag
      }
    }
  }, [messages, streamingMessage, isLoading]);

  // Remove project from scrolled set when loading starts (so it can scroll again after loading)
  useEffect(() => {
    if (isLoadingHistory) {
      scrolledProjectsRef.current.delete(projectId);
    }
  }, [projectId, isLoadingHistory]);

  // Scroll to bottom when first visiting a project (including page refresh)
  useEffect(() => {
    if (projectId && !scrolledProjectsRef.current.has(projectId) && !isLoadingHistory && messages.length > 0) {
      // Use double RAF to ensure DOM is fully rendered after isLoadingHistory becomes false
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom();
          scrolledProjectsRef.current.add(projectId);
        });
      });
    }
  }, [projectId, isLoadingHistory, messages.length, scrollToBottom]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  }, [isDragOver]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only reset drag state if we're actually leaving the container
    // This prevents flickering when dragging over child elements
    const container = e.currentTarget;
    const relatedTarget = e.relatedTarget as Node;

    if (!container.contains(relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleSend = useCallback(async (input: string, attachedFiles: File[]) => {
    if ((!input.trim() && attachedFiles.length === 0) || isLoading) return;

    // If AI is not configured, show onboarding dialog
    if (!isConfigured) {
      setShowOnboarding(true);
      return;
    }

    // If configured but no model selected, don't proceed
    if (!providerModel.trim()) return;

    setAIError(null);

    const modelToUse = providerModel.trim();

    // Build message content from input and attached files
    // Images are converted to base64-encoded data URLs
    const messageContent = await buildMessageContent(
      input,
      attachedFiles,
      fs,
      tmpPath
    );

    // Add model to recently used when sending a message
    addRecentlyUsedModel(modelToUse);

    // Mark that we should scroll to bottom when the message is added
    shouldScrollToBottomRef.current = true;

    await sendMessage(messageContent, modelToUse);
  }, [addRecentlyUsedModel, fs, isConfigured, isLoading, providerModel, sendMessage, tmpPath]);

  // Handle textarea focus - show onboarding if not configured
  const handleTextareaFocus = useCallback(() => {
    if (!isConfigured) {
      setShowOnboarding(true);
    }
    if (onFirstInteraction) {
      onFirstInteraction();
    }
  }, [isConfigured, onFirstInteraction]);

  // Handle first user interaction to enable audio context
  const handleFirstInteraction = useCallback(() => {
    // This will be handled automatically by the useKeepAlive hook
    // when isLoading becomes true after user interaction
    if (onFirstInteraction) {
      onFirstInteraction();
    }
  }, [onFirstInteraction]);

  // Expose startNewSession function via ref
  useImperativeHandle(ref, () => ({
    startNewSession: () => {
      internalStartNewSession();
    }
  }), [internalStartNewSession]);

  /** Render streaming message, loading skeleton, or tool loading state */
  const renderStreamingMessage = () => {
    if (streamingMessage) {
      const streamingToolCall = streamingMessage.tool_calls?.[0];
      return (
        <>
          {/* Show streaming message if text is streaming */}
          {(streamingMessage.content || streamingMessage.reasoning_content) && (
            <AIMessageItem
              key="streaming-message"
              message={streamingMessage}
              isCurrentlyLoading={isLoading}
              projectId={projectId}
            />
          )}
          {/* Show tool call in "calling" state if streaming tool call is in progress */}
          {(streamingToolCall?.type === 'function') ? (
            <ToolCallDisplay
              key="tool-calls-loading"
              toolName={streamingToolCall.function.name}
              toolArgs={(() => {
                try {
                  return JSON.parse(streamingToolCall.function.arguments);
                } catch {
                  return {};
                }
              })()}
              state="calling"
              projectId={projectId}
            />
          ) : (
            <>
              {/* Show loading skeleton if AI appears stuck generating tools */}
              {isStuck && (
                <div key="stuck-loading-skeleton" className="flex">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )
    }

    const lastMessage = messages[messages.length - 1] as AIMessage | undefined;
    const lastToolCall = lastMessage?.role === 'assistant' ? lastMessage?.tool_calls?.[0] : undefined;

    // Show tool call in "waiting" state if last tool call is still executing
    if (lastToolCall?.type === 'function') {
      return (
        <ToolCallDisplay
          key="tool-running-loading"
          toolName={lastToolCall.function.name}
          toolArgs={(() => {
            try {
              return JSON.parse(lastToolCall.function.arguments);
            } catch {
              return {};
            }
          })()}
          state="waiting"
          projectId={projectId}
        />
      );
    }

    // Fallback skeleton if AI is loading
    if (isLoading) {
      return (
        <div key="streaming-loading" className="flex">
          <div className="flex-1 min-w-0">
            <div className="text-sm space-y-2">
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="h-full flex flex-col relative">

      <div className="flex-1 overflow-y-scroll overflow-x-hidden" ref={scrollAreaRef}>
        <div className="p-4 space-y-4">
          {/* Template info banner - shown when conditions are met */}
          {showTemplateInfo && templateInfo && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase tracking-wide">
              <div className="flex-1 h-px bg-border" />
              <span>
                Vibing with{' '}
                <a
                  href={templateInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  {templateInfo.name}
                </a>
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}

          {/* Loading skeleton while loading history */}
          {isLoadingHistory && (
            <div className="space-y-6">
              {/* User message skeleton */}
              <div className="flex justify-end py-6">
                <div className="max-w-[80%] bg-secondary rounded-2xl rounded-br-md px-4 py-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
              </div>

              {/* Assistant message skeleton */}
              <div className="flex py-6">
                <div className="flex-1 min-w-0">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                </div>
              </div>

              {/* Another user message skeleton */}
              <div className="flex justify-end py-6">
                <div className="max-w-[80%] bg-secondary rounded-2xl rounded-br-md px-4 py-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-56" />
                  </div>
                </div>
              </div>

              {/* Another assistant message skeleton */}
              <div className="flex py-6">
                <div className="flex-1 min-w-0">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-11/12" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Empty state when no messages and not loading */}
          {!isLoadingHistory && messages.length === 0 && !streamingMessage && !isLoading && (
            <div className="flex-1 flex items-center justify-center min-h-[400px]">
              <div className="text-center space-y-4 max-w-md mx-auto">
                <div className="mb-6">
                  <ShakespeareLogo className="w-16 h-16 mx-auto" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {t('welcomeToShakespeare')}
                  </h3>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    {t('aiAssistantReady')}
                  </p>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>{t('askMeFeatures')}</p>
                    <p>{t('requestEdits')}</p>
                    <p>{t('getHelp')}</p>
                    <p>{t('buildDeploy')}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isLoadingHistory && messages.map((message, index) => {
            // Find the corresponding tool call for tool messages
            let toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall | undefined = undefined;
            if (message.role === 'tool') {
              // Look backwards to find the assistant message with matching tool call
              for (let i = index - 1; i >= 0; i--) {
                const prevMessage = messages[i];
                if (prevMessage.role === 'assistant' && 'tool_calls' in prevMessage && prevMessage.tool_calls) {
                  toolCall = prevMessage.tool_calls.find(tc => tc.id === message.tool_call_id);
                  if (toolCall) break;
                }
              }
            }

            return (
              <AIMessageItem
                key={`${index}-${message.role}-${typeof message.content === 'string' ? message.content.slice(0, 50) : 'content'}`}
                message={message}
                toolCall={toolCall}
                projectId={projectId}
              />
            );
          })}

          {!isLoadingHistory && renderStreamingMessage()}

          {/* Resume button - shown when not loading and finish reason is not "stop" or "length" (or no finish reason) */}
          {!isLoadingHistory && !isLoading && (!lastFinishReason || (lastFinishReason !== 'stop' && lastFinishReason !== 'length')) && messages.length > 0 && (
            <div className="flex justify-center py-4">
              <Button
                onClick={() => startGeneration(providerModel)}
                variant="outline"
                size="sm"
                disabled={!providerModel.trim() || !isConfigured}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                {t('resume')}
              </Button>
            </div>
          )}

          {/* Error Alert (Console or AI) - Don't show while assistant is loading */}
          {displayError && !isLoading && (
            <Quilly
              error={displayError}
              onDismiss={handleErrorDismiss}
              onNewChat={onNewChat}
              onOpenModelSelector={openModelSelector}
              onTryAgain={() => startGeneration(providerModel)}
              onRequestConsoleErrorHelp={handleConsoleErrorHelp}
              providerModel={providerModel}
            />
          )}
        </div>
      </div>

      {/* Scroll to bottom button */}
      {showScrollToBottom && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-10">
          <Button
            onClick={scrollToBottom}
            size="sm"
            variant="secondary"
            className="h-10 w-10 rounded-full shadow-lg border bg-background/80 backdrop-blur-sm hover:bg-background/90 transition-all duration-200"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}

      <ChatInput
        isLoading={isLoading}
        isConfigured={isConfigured}
        isLoadingSettings={isLoadingSettings}
        providerModel={providerModel}
        onProviderModelChange={handleModelChange}
        onSend={handleSend}
        onStop={stopGeneration}
        onFocus={handleTextareaFocus}
        onFirstInteraction={handleFirstInteraction}
        isModelSelectorOpen={isModelSelectorOpen}
        onModelSelectorOpenChange={setIsModelSelectorOpen}
        contextUsagePercentage={contextUsagePercentage}
        currentModelContextLength={currentModel?.contextLength}
        lastInputTokens={lastInputTokens}
        totalCost={totalCost}
        isDragOver={isDragOver}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      />

      {/* Onboarding Dialog */}
      <OnboardingDialog
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
      />
    </div>
  );
});
