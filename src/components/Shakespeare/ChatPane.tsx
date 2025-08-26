import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, Settings, Play, CloudUpload, Loader2, MessageSquarePlus, Square } from 'lucide-react';
import { useAISettings } from '@/hooks/useAISettings';
import { useFS } from '@/hooks/useFS';
import { useJSRuntime } from '@/hooks/useJSRuntime';
import { useKeepAlive } from '@/hooks/useKeepAlive';
import { useAIChat } from '@/hooks/useAIChat';
import { ModelSelector } from '@/components/ModelSelector';
import { copyDirectory } from '@/lib/copyFiles';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { bytesToHex } from 'nostr-tools/utils';
import { AIMessageItem } from '@/components/AIMessageItem';
import { GitHistoryDialog } from '@/components/ai/GitHistoryDialog';
import { TextEditorViewTool } from '@/lib/tools/TextEditorViewTool';
import { TextEditorWriteTool } from '@/lib/tools/TextEditorWriteTool';
import { TextEditorStrReplaceTool } from '@/lib/tools/TextEditorStrReplaceTool';
import { NpmAddPackageTool } from '@/lib/tools/NpmAddPackageTool';
import { NpmRemovePackageTool } from '@/lib/tools/NpmRemovePackageTool';
import { GitCommitTool } from '@/lib/tools/GitCommitTool';
import { BuildProjectTool } from '@/lib/tools/BuildProjectTool';
import { toolToOpenAI } from '@/lib/tools/openai-adapter';
import { Tool } from '@/lib/tools/Tool';
import OpenAI from 'openai';
import { buildProject } from "@/lib/build";

interface ChatPaneProps {
  projectId: string;
  projectName: string;
}

export function ChatPane({ projectId, projectName }: ChatPaneProps) {
  const [input, setInput] = useState('');
  const [isBuildLoading, setIsBuildLoading] = useState(false);
  const [isDeployLoading, setIsDeployLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { isConfigured, settings, addRecentlyUsedModel } = useAISettings();
  const [providerModel, setProviderModel] = useState(() => {
    // Initialize with first recently used model if available, otherwise empty
    return settings.recentlyUsedModels?.[0] || '';
  });
  const { fs: browserFS } = useFS();
  const { runtime } = useJSRuntime();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize AI chat with tools
  const cwd = `/projects/${projectId}`;
  const customTools = {
    git_commit: new GitCommitTool(browserFS, cwd),
    text_editor_view: new TextEditorViewTool(browserFS, cwd),
    text_editor_write: new TextEditorWriteTool(browserFS, cwd),
    text_editor_str_replace: new TextEditorStrReplaceTool(browserFS, cwd),
    npm_add_package: new NpmAddPackageTool(browserFS, cwd),
    npm_remove_package: new NpmRemovePackageTool(browserFS, cwd),
    build_project: new BuildProjectTool(browserFS, cwd),
  };

  // Convert tools to OpenAI format
  const tools: Record<string, OpenAI.Chat.Completions.ChatCompletionTool> = {};
  for (const [name, tool] of Object.entries(customTools)) {
    tools[name] = toolToOpenAI(name, tool as Tool<unknown>);
  }

  const systemPrompt = `You are an AI assistant helping users build custom Nostr websites. You have access to tools that allow you to read, write, and manage files in the project, as well as build the project and manage npm packages.

Key capabilities:
- Read and write files in the project
- List directory contents
- Check if files exist
- Build the project using esbuild (use the build_project tool)
- Get project structure overview
- Search through files
- Add and remove npm packages
- Install dependencies and dev dependencies
- Commit changes to git with automatic staging

Guidelines:
- Always check if files exist before writing to avoid overwriting
- Provide helpful explanations of what you're doing
- Suggest improvements and best practices
- Use modern React patterns and TypeScript
- Follow Nostr protocol standards when relevant
- Ensure the project builds successfully

The project uses:
- React 18 with TypeScript
- esbuild for building
- TailwindCSS for styling
- Nostrify for Nostr integration
- shadcn/ui components

When creating new components or pages, follow the existing patterns in the codebase.`;

  const {
    messages,
    streamingMessage,
    isLoading,
    sendMessage,
    startGeneration,
    stopGeneration,
    startNewSession,
  } = useAIChat({
    projectId,
    projectName,
    tools,
    customTools,
    systemPrompt,
    onUpdateMetadata: (title, description) => {
      updateMetadata(title, description);
    }
  });

  // Check for autostart parameter and trigger AI generation
  useEffect(() => {
    const autostart = searchParams.get('autostart');
    const urlModel = searchParams.get('model');

    if (autostart === 'true' && isConfigured && messages.length > 0 && !isLoading) {
      const lastMessage = messages[messages.length - 1];

      // If the last message is from the user, auto-start the AI
      if (lastMessage.role === 'user') {
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
    }
  }, [searchParams, setSearchParams, isConfigured, messages, isLoading, startGeneration, providerModel, setProviderModel, addRecentlyUsedModel]);

  // Keep-alive functionality to prevent tab throttling during AI processing
  const { updateMetadata } = useKeepAlive({
    enabled: isLoading || isBuildLoading || isDeployLoading,
    title: 'Shakespeare',
    artist: `Working on ${projectName}...`,
    artwork: [
      {
        src: '/favicon.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  });

  const runBuild = async () => {
    if (isBuildLoading) return;

    setIsBuildLoading(true);
    updateMetadata('Shakespeare', `Building ${projectName}...`);

    const dist = await buildProject({
      fs: browserFS,
      projectPath: `/projects/${projectId}`,
      domParser: new DOMParser(),
      target: "esnext",
    });

    console.log(dist);

    // Delete all existing files in "dist" directory
    try {
      for (const file of await browserFS.readdir(`/projects/${projectId}/dist`)) {
        await browserFS.unlink(`/projects/${projectId}/dist/${file}`);
      }
    } catch {
      // Ignore errors (e.g., directory doesn't exist)
    }

    await browserFS.mkdir(`/projects/${projectId}/dist`, { recursive: true });

    for (const [path, contents] of Object.entries(dist)) {
      await browserFS.writeFile(`/projects/${projectId}/dist/${path}`, contents);
    }

    setIsBuildLoading(false);
  };

  const runDeploy = async () => {
    if (isDeployLoading) return;

    setIsDeployLoading(true);
    updateMetadata('Shakespeare', `Deploying ${projectName}...`);
    try {
      const runtimeFS = await runtime.fs();

      const sk = generateSecretKey();
      const pubkey = getPublicKey(sk);
      const npub = nip19.npubEncode(pubkey);

      const projectUrl = `https://${npub}.nostrdeploy.com`;
      console.log('Running deploy for project:', projectId, 'at', projectUrl);

      await runtimeFS.mkdir('dist', { recursive: true });

      await runtimeFS.writeFile('.env.nostr-deploy.local', `# Nostr Deploy CLI Configuration
# This file contains sensitive information - do not commit to version control

# Nostr Authentication
NOSTR_PRIVATE_KEY=${bytesToHex(sk)}
NOSTR_PUBLIC_KEY=${pubkey}
NOSTR_RELAYS=wss://relay.nostr.band,wss://nostrue.com,wss://purplerelay.com,wss://relay.primal.net,wss://ditto.pub/relay

# Blossom File Storage
BLOSSOM_SERVERS=https://cdn.hzrd149.com,https://blossom.primal.net,https://blossom.band,https://blossom.f7z.io

# Deployment Settings
BASE_DOMAIN=nostrdeploy.com`);

      // Copy "dist" files to runtime filesystem
      const distPath = `/projects/${projectId}/dist`;
      try {
        await copyDirectory(browserFS, runtimeFS, distPath, 'dist');
        console.log('Successfully copied dist to runtime');
      } catch (error) {
        console.error('Failed to copy dist to runtime:', error);
        return;
      }

      const proc = await runtime.spawn('npx', ["-y", "nostr-deploy-cli", "deploy"]);
      await proc.exit;

      console.log('Project deployed:', projectUrl);
    } catch (error) {
      console.error('Deploy failed:', error);
    } finally {
      setIsDeployLoading(false);
    }
  };

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

  const handleSend = async () => {
    if (!input.trim() || isLoading || !providerModel.trim()) return;

    const messageContent = input;
    const modelToUse = providerModel.trim();
    setInput('');

    // Add model to recently used when sending a message
    addRecentlyUsedModel(modelToUse);

    try {
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

  // Handle first user interaction to enable audio context
  const handleFirstInteraction = () => {
    // This will be handled automatically by the useKeepAlive hook
    // when isLoading becomes true after user interaction
  };

  if (!isConfigured) {
    return (
      <div className="h-full flex flex-col">
        <div className="border-b bg-gradient-to-r from-primary/5 to-accent/5 px-4 py-3 flex justify-between items-center">
          <div>
            <h2 className="font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">AI Assistant</h2>
            <p className="text-sm text-muted-foreground">Chat to build your project</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 hover:bg-primary/10 hover:border-primary/20"
            onClick={() => {
              // This will be handled by the AISettingsDialog component
              const event = new CustomEvent('openAISettings');
              window.dispatchEvent(event);
            }}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>

        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
          <div className="text-center space-y-4 max-w-md mx-auto p-6">
            <div className="text-4xl mb-4">🤖</div>
            <div>
              <h3 className="text-lg font-semibold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">AI Assistant Not Configured</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Please configure your AI settings to start building with AI assistance.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 hover:bg-primary/10 hover:border-primary/20"
                onClick={() => {
                  const event = new CustomEvent('openAISettings');
                  window.dispatchEvent(event);
                }}
              >
                <Settings className="h-4 w-4" />
                Configure AI Settings
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }



  return (
    <div className="h-full flex flex-col">
      <div className="border-b bg-gradient-to-r from-primary/5 to-accent/5 px-4 py-3 flex justify-between items-center">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">AI Assistant</h2>
          <p className="text-sm text-muted-foreground hidden sm:block">Chat to build your project</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1 sm:gap-2 hover:bg-secondary/10 hover:border-secondary/20"
            onClick={startNewSession}
            disabled={isLoading}
            title="Start a new chat session"
          >
            <MessageSquarePlus className="h-4 w-4" />
            <span className="hidden sm:inline">New Chat</span>
          </Button>
          <GitHistoryDialog projectId={projectId} />
          <Button
            variant="outline"
            size="sm"
            className="gap-1 sm:gap-2 hover:bg-primary/10 hover:border-primary/20"
            onClick={runBuild}
            onMouseDown={handleFirstInteraction}
            disabled={isBuildLoading || isDeployLoading || isLoading}
          >
            {isBuildLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {isBuildLoading ? 'Building...' : 'Build'}
            </span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 sm:gap-2 hover:bg-accent/10 hover:border-accent/20"
            onClick={runDeploy}
            onMouseDown={handleFirstInteraction}
            disabled={isDeployLoading || isBuildLoading || isLoading}
          >
            {isDeployLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CloudUpload className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {isDeployLoading ? 'Deploying...' : 'Deploy'}
            </span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-scroll overflow-x-hidden" ref={scrollAreaRef}>
        <div className="p-4 space-y-4">
          {messages.map((message, index) => {
            // Skip assistant messages with no content
            if (message.role === 'assistant' && !message.content) {
              return null;
            }

            // Find the corresponding tool call for tool messages
            let toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall | undefined = undefined;
            if (message.role === 'tool' && 'tool_call_id' in message) {
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
                isCurrentlyLoading
              />
            ) : (
              <div key="streaming-loading" className="flex">
                <div className="flex-1 min-w-0">
                  <div className="text-sm space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              </div>
            )
          )}
          {streamingMessage?.tool_calls?.[0]?.type === 'function' && (
            <div key="tool-calls-loading" className="-mt-2">
              <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
                <span className="font-medium">
                  Running {streamingMessage.tool_calls[0].function.name}...
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t p-4">
        {/* Chat Input Container */}
        <div className="relative rounded-2xl border border-input bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 transition-all">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFirstInteraction}
            placeholder={providerModel.trim() ? "Ask me to add features, edit files, or build your project..." : "Please select a model to start chatting..."}
            className="min-h-[52px] max-h-32 resize-none border-0 bg-transparent px-4 py-3 pb-12 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
            disabled={isLoading || !providerModel.trim()}
            rows={1}
            style={{
              height: 'auto',
              minHeight: '52px'
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 128) + 'px';
            }}
          />

          {/* Bottom Controls Row */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2">
            {/* Model Selector */}
            <div className="flex-1 max-w-72 ml-auto">
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
                  className="h-8 w-8 rounded-lg p-0 hover:bg-muted"
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSend}
                  onMouseDown={handleFirstInteraction}
                  disabled={!input.trim() || !providerModel.trim()}
                  size="sm"
                  className="h-8 w-8 rounded-lg p-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
