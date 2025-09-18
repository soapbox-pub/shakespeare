import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { CircularProgress } from '@/components/ui/circular-progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FileAttachment } from '@/components/ui/file-attachment';
import { Square, Loader2, ChevronDown, ArrowUp } from 'lucide-react';
import { useAISettings } from '@/hooks/useAISettings';
import { useFS } from '@/hooks/useFS';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useKeepAlive } from '@/hooks/useKeepAlive';
import { useAIChat } from '@/hooks/useAIChat';
import { useProviderModels } from '@/hooks/useProviderModels';
import { ModelSelector } from '@/components/ModelSelector';
import { AIMessageItem } from '@/components/AIMessageItem';
import { TextEditorViewTool } from '@/lib/tools/TextEditorViewTool';
import { TextEditorWriteTool } from '@/lib/tools/TextEditorWriteTool';
import { TextEditorStrReplaceTool } from '@/lib/tools/TextEditorStrReplaceTool';
import { NpmAddPackageTool } from '@/lib/tools/NpmAddPackageTool';
import { NpmRemovePackageTool } from '@/lib/tools/NpmRemovePackageTool';
import { GitCommitTool } from '@/lib/tools/GitCommitTool';
import { BuildProjectTool } from '@/lib/tools/BuildProjectTool';
import { DeployProjectTool } from '@/lib/tools/DeployProjectTool';
import { NostrReadNipTool } from '@/lib/tools/NostrReadNipTool';
import { NostrFetchEventTool } from '@/lib/tools/NostrFetchEventTool';
import { NostrReadKindTool } from '@/lib/tools/NostrReadKindTool';
import { NostrReadTagTool } from '@/lib/tools/NostrReadTagTool';
import { NostrReadProtocolTool } from '@/lib/tools/NostrReadProtocolTool';
import { NostrReadNipsIndexTool } from '@/lib/tools/NostrReadNipsIndexTool';
import { NostrGenerateKindTool } from '@/lib/tools/NostrGenerateKindTool';
import { ShellTool } from '@/lib/tools/ShellTool';
import { TypecheckTool } from '@/lib/tools/TypecheckTool';
import { Git } from '@/lib/git';
import { toolToOpenAI } from '@/lib/tools/openai-adapter';
import { Tool } from '@/lib/tools/Tool';
import OpenAI from 'openai';
import { makeSystemPrompt } from '@/lib/system';
import { assistantContentEmpty } from '@/lib/ai-messages';
import { saveFileToTmp } from '@/lib/fileUtils';

interface ChatPaneProps {
  projectId: string;
  onNewChat?: () => void;
  onBuild?: () => void;
  onDeploy?: () => void;
  onFirstInteraction?: () => void;
  onLoadingChange?: (isLoading: boolean) => void;
  isLoading?: boolean;
  isBuildLoading?: boolean;
  isDeployLoading?: boolean;
}

export interface ChatPaneRef {
  startNewSession: () => void;
}

export const ChatPane = forwardRef<ChatPaneRef, ChatPaneProps>(({
  projectId,
  onNewChat: _onNewChat,
  onBuild: _onBuild,
  onDeploy: _onDeploy,
  onFirstInteraction,
  onLoadingChange,
  isLoading: externalIsLoading,
  isBuildLoading: externalIsBuildLoading,
  isDeployLoading: externalIsDeployLoading
}, ref) => {
  const [input, setInput] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [scrolledProjects] = useState(() => new Set<string>());

  // Use external state if provided, otherwise default to false
  const isBuildLoading = externalIsBuildLoading || false;
  const isDeployLoading = externalIsDeployLoading || false;
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { isConfigured, settings, addRecentlyUsedModel } = useAISettings();
  const [providerModel, setProviderModel] = useState(() => {
    // Initialize with first recently used model if available, otherwise empty
    return settings.recentlyUsedModels?.[0] || '';
  });

  useEffect(() => {
    if (!providerModel && settings.recentlyUsedModels?.length) {
      setProviderModel(settings.recentlyUsedModels[0]);
    }
  }, [providerModel, settings.recentlyUsedModels]);

  const [searchParams, setSearchParams] = useSearchParams();
  const { fs } = useFS();
  const { user, metadata } = useCurrentUser();
  const { models } = useProviderModels();

  // Initialize AI chat with tools
  const cwd = `/projects/${projectId}`;
  const customTools = useMemo(() => {
    const git = new Git(fs);
    const baseTools = {
      git_commit: new GitCommitTool(fs, cwd, git),
      text_editor_view: new TextEditorViewTool(fs, cwd),
      text_editor_write: new TextEditorWriteTool(fs, cwd),
      text_editor_str_replace: new TextEditorStrReplaceTool(fs, cwd),
      npm_add_package: new NpmAddPackageTool(fs, cwd),
      npm_remove_package: new NpmRemovePackageTool(fs, cwd),
      build_project: new BuildProjectTool(fs, cwd),
      typecheck: new TypecheckTool(fs, cwd),
      nostr_read_nip: new NostrReadNipTool(),
      nostr_fetch_event: new NostrFetchEventTool(),
      nostr_read_kind: new NostrReadKindTool(),
      nostr_read_tag: new NostrReadTagTool(),
      nostr_read_protocol: new NostrReadProtocolTool(),
      nostr_read_nips_index: new NostrReadNipsIndexTool(),
      nostr_generate_kind: new NostrGenerateKindTool(),
      shell: new ShellTool(fs, cwd, git),
    };

    // Add deploy tool only if user is logged in
    if (user && user.signer) {
      return {
        ...baseTools,
        deploy_project: new DeployProjectTool(fs, cwd, user.signer, projectId),
      };
    }

    return baseTools;
  }, [fs, cwd, user, projectId]);

  // Convert tools to OpenAI format
  const tools = useMemo(() => {
    const result: Record<string, OpenAI.Chat.Completions.ChatCompletionTool> = {};
    for (const [name, tool] of Object.entries(customTools)) {
      result[name] = toolToOpenAI(name, tool as Tool<unknown>);
    }
    return result;
  }, [customTools]);

  // Keep-alive functionality to prevent tab throttling during AI processing
  const { updateMetadata } = useKeepAlive({
    enabled: externalIsLoading || isBuildLoading || isDeployLoading,
    title: 'Shakespeare',
    artist: `Working on ${projectId}...`,
    artwork: [
      {
        src: '/favicon.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  });

  // Memoize the metadata update callback to avoid unnecessary re-renders
  const onUpdateMetadata = useCallback((title: string, description: string) => {
    updateMetadata(title, description);
  }, [updateMetadata]);

  useEffect(() => {
    makeSystemPrompt({
      cwd,
      fs,
      mode: "agent",
      name: "Shakespeare",
      profession: "software extraordinaire",
      tools: Object.values(tools),
      user,
      metadata,
    }).then(setSystemPrompt)
  }, [fs, cwd, tools, user, metadata]);

  const {
    messages,
    streamingMessage,
    isLoading: internalIsLoading,
    totalCost,
    lastInputTokens,
    sendMessage,
    startGeneration,
    stopGeneration,
    startNewSession: internalStartNewSession,
  } = useAIChat({
    projectId,
    tools,
    customTools,
    systemPrompt,
    onUpdateMetadata,
  });

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

  // Check for autostart parameter and trigger AI generation
  useEffect(() => {
    const autostart = searchParams.get('autostart');
    const urlModel = searchParams.get('model');

    if (autostart === 'true' && isConfigured) {
      // Use model from URL if available, otherwise use current selection
      const modelToUse = urlModel?.trim() || providerModel.trim();

      if (modelToUse) {
        // Update provider model if it came from URL
        if (urlModel?.trim() && urlModel.trim() !== providerModel) {
          setProviderModel(urlModel.trim());
        }

        // Clear the autostart and model parameters so they don't trigger again
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('autostart');
        newSearchParams.delete('model');
        setSearchParams(newSearchParams, { replace: true });

        // Start AI generation
        addRecentlyUsedModel(modelToUse);
        startGeneration(modelToUse);
      }
    }
  }, [addRecentlyUsedModel, isConfigured, providerModel, searchParams, setSearchParams, startGeneration]);


  // Function to scroll to bottom
  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  };

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
      // Check if user was already at or near the bottom (within 100px threshold)
      const threshold = 100;
      const container = scrollAreaRef.current;
      const isNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - threshold;

      // Only auto-scroll if user was already near the bottom
      if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }

    }
  }, [messages, streamingMessage, isLoading]);

  // Scroll to bottom when first visiting a project (including page refresh)
  useEffect(() => {
    if (projectId && !scrolledProjects.has(projectId)) {
      // Small delay to ensure messages have loaded
      const timer = setTimeout(() => {
        scrollToBottom();
        scrolledProjects.add(projectId);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [projectId, scrolledProjects]);

  const handleFileSelect = (file: File) => {
    setAttachedFiles(prev => [...prev, file]);
  };

  const handleFileRemove = (fileToRemove: File) => {
    setAttachedFiles(prev => prev.filter(file => file !== fileToRemove));
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only reset drag state if we're actually leaving the container
    // This prevents flickering when dragging over child elements
    const container = e.currentTarget;
    const relatedTarget = e.relatedTarget as Node;

    if (!container.contains(relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (isLoading || !providerModel.trim()) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Add all files without validation
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const handleSend = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isLoading || !providerModel.trim()) return;

    const modelToUse = providerModel.trim();

    // Build message content as text parts
    const contentParts: Array<OpenAI.Chat.Completions.ChatCompletionContentPartText> = [];

    // Add user input as text part if present
    if (input.trim()) {
      contentParts.push({
        type: 'text',
        text: input.trim()
      });
    }

    // Process attached files and add as separate text parts
    if (attachedFiles.length > 0) {
      const filePromises = attachedFiles.map(async (file) => {
        try {
          const savedPath = await saveFileToTmp(fs, file);
          return `Added file: ${savedPath}`;
        } catch (error) {
          console.error('Failed to save file:', error);
          return `Failed to save file: ${file.name}`;
        }
      });

      const fileResults = await Promise.all(filePromises);

      // Add each file as a separate text part
      fileResults.forEach(fileResult => {
        contentParts.push({
          type: 'text',
          text: fileResult
        });
      });
    }

    setInput('');
    setAttachedFiles([]);

    // Add model to recently used when sending a message
    addRecentlyUsedModel(modelToUse);

    try {
      // Send as text parts if we have multiple parts, otherwise send as string for simplicity
      const messageContent = contentParts.length === 1 ? contentParts[0].text : contentParts;
      await sendMessage(messageContent, modelToUse);
    } catch (error) {
      console.error('AI chat error:', error);
      // Error handling is done in the useAIChat hook
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Check if the item is an image
      if (item.type.startsWith('image/')) {
        e.preventDefault(); // Prevent default paste behavior for images

        const file = item.getAsFile();
        if (file) {
          // Generate a filename with timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const extension = file.type.split('/')[1] || 'png';
          const filename = `pasted-image-${timestamp}.${extension}`;

          // Create a new File object with the generated name
          const namedFile = new File([file], filename, { type: file.type });

          // Add to attached files
          setAttachedFiles(prev => [...prev, namedFile]);
        }
        break; // Only handle the first image found
      }
    }
  };

  // Handle first user interaction to enable audio context
  const handleFirstInteraction = () => {
    // This will be handled automatically by the useKeepAlive hook
    // when isLoading becomes true after user interaction
    if (onFirstInteraction) {
      onFirstInteraction();
    }
  };

  // Expose startNewSession function via ref
  useImperativeHandle(ref, () => ({
    startNewSession: () => {
      internalStartNewSession();
    }
  }), [internalStartNewSession]);

  if (!isConfigured) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
          <div className="text-center space-y-4 max-w-md mx-auto p-6">
            <div className="text-4xl mb-4">🤖</div>
            <div>
              <h3 className="text-lg font-semibold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">AI Assistant Not Configured</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Please configure your AI settings to start building with AI assistance.
              </p>
              <p className="text-sm text-muted-foreground">
                Use the menu in the top bar to access AI Settings.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }



  return (
    <div className="h-full flex flex-col relative">

      <div className="flex-1 overflow-y-scroll overflow-x-hidden" ref={scrollAreaRef}>
        <div className="p-4 space-y-4">
          {/* Empty state when no messages and not loading */}
          {messages.length === 0 && !streamingMessage && !isLoading && (
            <div className="flex-1 flex items-center justify-center min-h-[400px]">
              <div className="text-center space-y-4 max-w-md mx-auto">
                <div className="text-6xl mb-6">🎭</div>
                <div>
                  <h3 className="text-xl font-semibold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Welcome to Shakespeare
                  </h3>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    Your AI-powered development assistant is ready to help you build, edit, and enhance your project.
                  </p>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>💡 Ask me to add new features</p>
                    <p>📝 Request file edits and improvements</p>
                    <p>🔧 Get help with debugging and optimization</p>
                    <p>🚀 Build and deploy your project</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {messages.map((message, index) => {
            // Skip assistant messages with no content
            if (message.role === 'assistant' && assistantContentEmpty(message.content)) {
              return null;
            }

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
              />
            );
          })}
          {streamingMessage && (
            streamingMessage.content ? (
              <AIMessageItem
                key="streaming-message"
                message={streamingMessage}
                isCurrentlyLoading={isLoading}
              />
            ) : (
              !(streamingMessage?.tool_calls?.[0]?.type === 'function') && (
                <div key="streaming-loading" className="flex">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                </div>
              )
            )
          )}
          {streamingMessage?.tool_calls?.[0]?.type === 'function' && (
            <div key="tool-calls-loading" className="-mt-2">
              <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
                <span className="font-medium">
                  Running {streamingMessage.tool_calls?.[0]?.function?.name || 'tool'}...
                </span>
              </div>
            </div>
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

      <div className="border-t p-4">
        {/* Chat Input Container */}
        <div
          className={`flex flex-col rounded-2xl border border-input bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 transition-all ${
            isDragOver ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : ''
          }`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={handleFirstInteraction}
            placeholder={providerModel.trim() ? "Ask me to add features, edit files, or build your project..." : "Please select a model to start chatting..."}
            className="flex-1 resize-none border-0 bg-transparent px-4 py-3 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
            disabled={isLoading || !providerModel.trim()}
            rows={1}
            aria-label="Chat message input"
            style={{
              height: 'auto',
              minHeight: '96px'
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 128) + 'px';
            }}
          />

          {/* Bottom Controls Row */}
          <div className="flex items-center gap-4 px-2 py-2">
            {/* File Attachment */}
            <FileAttachment
              onFileSelect={handleFileSelect}
              onFileRemove={handleFileRemove}
              selectedFiles={attachedFiles}
              disabled={isLoading}
              multiple={true}
            />

            {/* Context Usage Wheel */}
            {contextUsagePercentage >= 10 && currentModel?.contextLength && lastInputTokens > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <CircularProgress
                        value={contextUsagePercentage}
                        size={20}
                        strokeWidth={2}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Context usage: {lastInputTokens.toLocaleString()} / {currentModel.contextLength.toLocaleString()} tokens ({contextUsagePercentage.toFixed(1)}%)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Cost Display */}
            {totalCost >= 0.01 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-xs text-muted-foreground px-2 py-1 bg-muted/50 rounded-md whitespace-nowrap cursor-help">
                      ${totalCost.toFixed(2)}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total cost for this chat session</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Model Selector */}
            <div className="flex-1 max-w-72 ml-auto overflow-hidden">
              <ModelSelector
                value={providerModel}
                onChange={setProviderModel}
                className="w-full"
                disabled={isLoading}
                placeholder="Choose a model..."
              />
            </div>

            {/* Send/Stop Button */}
            <div>
              {isLoading ? (
                <Button
                  onClick={stopGeneration}
                  size="sm"
                  variant="ghost"
                  className="size-8 rounded-full p-0 bg-foreground/10 [&_svg]:size-3.5 [&_svg]:fill-foreground hover:bg-foreground/20"
                >
                  <Square />
                </Button>
              ) : (
                <Button
                  onClick={handleSend}
                  onMouseDown={handleFirstInteraction}
                  disabled={(!input.trim() && attachedFiles.length === 0) || !providerModel.trim()}
                  size="sm"
                  className="size-8 [&_svg]:size-5 rounded-full p-0"
                >
                  <ArrowUp />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
