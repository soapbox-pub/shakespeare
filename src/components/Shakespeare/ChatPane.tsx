import { useState, useRef, useEffect } from 'react';
import { CoreMessage, generateText, CoreUserMessage, CoreAssistantMessage, CoreToolMessage, generateId } from 'ai';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Settings, Play, CloudUpload, Loader2 } from 'lucide-react';
import { useAISettings } from '@/hooks/useAISettings';
import { useFS } from '@/hooks/useFS';
import { useJSRuntime } from '@/hooks/useJSRuntime';
import { useKeepAlive } from '@/hooks/useKeepAlive';
import { copyDirectory } from '@/lib/copyFiles';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { bytesToHex } from 'nostr-tools/utils';
import { MessageItem } from '@/components/ai/MessageItem';
import { GitHistoryDialog } from '@/components/ai/GitHistoryDialog';
import { TextEditorViewTool } from '@/lib/tools/TextEditorViewTool';
import { TextEditorWriteTool } from '@/lib/tools/TextEditorWriteTool';
import { TextEditorStrReplaceTool } from '@/lib/tools/TextEditorStrReplaceTool';
import { NpmAddPackageTool } from '@/lib/tools/NpmAddPackageTool';
import { NpmRemovePackageTool } from '@/lib/tools/NpmRemovePackageTool';
import { GitCommitTool } from '@/lib/tools/GitCommitTool';
import { buildProject } from "@/lib/build";

interface ChatPaneProps {
  projectId: string;
  projectName: string;
}

interface ValidationError {
  name: string;
  issues?: Array<{ path: (string | number)[]; message: string }>;
  cause?: ValidationError;
}

type AIMessage = (CoreUserMessage | CoreAssistantMessage | CoreToolMessage) & { id: string };

export function ChatPane({ projectId, projectName }: ChatPaneProps) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBuildLoading, setIsBuildLoading] = useState(false);
  const [isDeployLoading, setIsDeployLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<AIMessage[]>([]);
  const autoFixAttemptsRef = useRef(0);
  const [shouldSwitchToPreview, setShouldSwitchToPreview] = useState(false);

  // Handle preview tab switching via React state instead of DOM manipulation
  useEffect(() => {
    if (shouldSwitchToPreview) {
      // This will be handled by the parent component that controls tabs
      // We'll emit a custom event that the parent can listen to
      const switchEvent = new CustomEvent('switchToPreview', {
        detail: { projectId },
      });
      window.dispatchEvent(switchEvent);
      setShouldSwitchToPreview(false);
    }
  }, [shouldSwitchToPreview, projectId]);
  const { settings, isConfigured } = useAISettings();
  const { fs: browserFS } = useFS();
  const { runtime } = useJSRuntime();

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

  const addMessage = (message: AIMessage) => {
    setMessages((prev) => {
      const messageMap = new Map(prev.map(m => [m.id, m])).set(message.id, message);
      const newMessages = Array.from(messageMap.values());
      messagesRef.current = newMessages;
      return newMessages;
    });
  };

  const addMessages = (newMessages: AIMessage[]) => {
    setMessages((prev) => {
      const messageMap = new Map(prev.map(m => [m.id, m]));
      newMessages.forEach(msg => messageMap.set(msg.id, msg));
      const updatedMessages = Array.from(messageMap.values());
      messagesRef.current = updatedMessages;
      return updatedMessages;
    });
  };



  // Unified auto-fix handler
  const handleAutoFix = async (errorType: 'build' | 'api', error: unknown) => {
    if (autoFixAttemptsRef.current >= 3) {
      const errorDetails = error instanceof Error ? error.message : 'Unknown error';
      addMessage({
        id: generateId(),
        role: 'assistant',
        content: `⚠️ Auto-fix attempt limit reached. Please ${errorType === 'build' ? 'fix the build error' : 'try rephrasing your request'} manually: ${errorDetails}`,
      });
      setIsLoading(false);
      return;
    }

    autoFixAttemptsRef.current++;
    console.log(`Auto-fix ${errorType} error attempt ${autoFixAttemptsRef.current}/3`);

    const errorDetails = error instanceof Error ? error.message : 'Unknown error';

    const createFixMessages = (): [AIMessage, AIMessage] => {
      const baseErrorMessage = {
        id: generateId(),
        role: 'assistant' as const,
        content: errorType === 'build'
          ? `❌ Auto-build failed. Analyzing error and attempting to fix automatically...`
          : `❌ AI response error detected. Analyzing and attempting to fix automatically...`,
      };

      if (errorType === 'build') {
        const buildErrorContent = typeof error === 'object' && error !== null && 'toString' in error
          ? error.toString()
          : errorDetails;

        const fixRequest: AIMessage = {
          id: generateId(),
          role: 'user',
          content: `The build failed with the following error. Please analyze this error and fix the issue:

\`\`\`
${buildErrorContent}
\`\`\`

Common issues to check:
- Missing npm dependencies (install with npm_add_package tool)
- TypeScript errors (fix type definitions or imports)
- Missing files (create necessary files)
- Configuration issues (update config files)

Please fix this issue and ensure the project builds successfully.`,
        };

        return [baseErrorMessage, fixRequest];
      }

      const caughtError = error as ValidationError;
      const errorCause = caughtError.cause;
      let validationErrors = '';

      if ((caughtError.name === 'AI_TypeValidationError' || caughtError.name === 'ZodError') && caughtError.issues) {
        validationErrors = caughtError.issues
          .map(issue => `- ${issue.path.join('.')}: ${issue.message}`)
          .join('\n');
      } else if (errorCause?.issues) {
        validationErrors = errorCause.issues
          .map(issue => `- ${issue.path.join('.')}: ${issue.message}`)
          .join('\n');
      }

      const fixRequest: AIMessage = {
        id: generateId(),
        role: 'user',
        content: `The AI generated an invalid response that caused an error. Please analyze this error and regenerate a valid response:

\`\`\`
Error Type: ${caughtError.name}
Error Details: ${errorDetails}
${validationErrors ? `Validation Errors:\n${validationErrors}` : ''}
${errorCause ? `Cause: ${JSON.stringify(errorCause, null, 2)}` : ''}
\`\`\`

Common issues to check:
- Malformed tool calls (ensure all tool calls have proper 'name' and 'arguments' fields)
- Invalid JSON structure in responses
- Missing required fields in function calls
- Improperly formatted arguments
- Tool call name is undefined or empty
- Arguments are missing or malformed

Please regenerate your response with the same intent but ensure it's properly formatted and valid. Make sure all tool calls are complete and correctly structured. Double-check that:
1. Every tool call has a 'name' field with the exact tool name
2. Every tool call has an 'arguments' field with valid JSON
3. All required arguments are provided
4. The JSON structure is valid`,
      };

      return [baseErrorMessage, fixRequest];
    };

    const [errorMessage, fixRequest] = createFixMessages();
    addMessage(errorMessage);
    addMessage(fixRequest);

    try {
      updateMetadata('Shakespeare', `Fixing ${errorType} error for ${projectName}...`);
      const currentMessages = messagesRef.current;
      await createAIChat(projectId, [...currentMessages, errorMessage, fixRequest]);
    } catch (fixError) {
      console.error('Failed to get AI to fix error:', fixError);
      addMessage({
        id: generateId(),
        role: 'assistant',
        content: `❌ Failed to auto-fix the ${errorType} error. Please ${errorType === 'build' ? 'try fixing manually' : 'try rephrasing your request or try again later'}: ${errorDetails}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

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
    // Add welcome message
    addMessage({
      id: generateId(),
      role: 'assistant',
      content: `Hello! I'm here to help you build "${projectName}". I can help you edit files, add new features, and build your Nostr website. What would you like to work on?`,
    });
  }, [projectName, projectId]);

  useEffect(() => {
    if (scrollAreaRef.current && messages) {
      // Check if user was already at or near the bottom (within 100px threshold)
      const threshold = 100;
      const container = scrollAreaRef.current;
      const isNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - threshold;

      // Only auto-scroll if user was already near the bottom
      if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  const createAIChat = async (projectId: string, messages: CoreMessage[]) => {
    if (!isConfigured) {
      throw new Error('AI settings not configured');
    }

    // Reset auto-fix attempts on new successful AI interaction
    autoFixAttemptsRef.current = 0;

    // Create a custom fetch function for the AI provider
    const customFetch = async (url: string, options: RequestInit) => {
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${settings.apiKey}`,
        },
      });
    };

    // Import the appropriate provider based on the base URL
    const { createOpenAI } = await import('@ai-sdk/openai');
    const openai = createOpenAI({
      baseURL: settings.baseUrl,
      apiKey: settings.apiKey,
      fetch: settings.baseUrl.includes('openrouter.ai') ? customFetch : undefined,
    });

    const provider = openai(settings.model);
    const cwd = `/projects/${projectId}`;

    return generateText({
      model: provider,
      messages,
      maxSteps: 100,
      onStepFinish(stepResult) {
        console.log(stepResult);
        addMessages(stepResult.response.messages);

        // Update media session with current step info
        const lastMessage = stepResult.response.messages[stepResult.response.messages.length - 1];
        if (lastMessage?.role === 'tool') {
          const toolName = lastMessage.content?.[0]?.toolName;
          if (toolName) {
            updateMetadata('Shakespeare', `Working on ${projectName} - ${toolName}`);
          }
        }

        // Check if this is the final step with a successful finish reason
        if (stepResult.finishReason === 'stop' && stepResult.response.messages.length > 0) {
          console.log('Agent finished successfully, auto-building project...');
          autoFixAttemptsRef.current = 0;

          setTimeout(async () => {
            if (isBuildLoading || isDeployLoading) {
              addMessage({
                id: generateId(),
                role: 'assistant',
                content: '⏸️ Build or deploy already in progress. Skipping auto-build.',
              });
              return;
            }

            try {
              await runBuild();

              window.dispatchEvent(new CustomEvent('buildComplete', { detail: { projectId } }));
              setShouldSwitchToPreview(true);

              addMessage({
                id: generateId(),
                role: 'assistant',
                content: '✅ Agent completed successfully. Project built! Switch to the "Preview" tab to see your changes.',
              });
            } catch (error) {
              console.error('Auto-build failed:', error);
              await handleAutoFix('build', error);
            }
          }, 1000);
        }
      },
      tools: {
        git_commit: new GitCommitTool(browserFS, cwd),
        text_editor_view: new TextEditorViewTool(browserFS, cwd),
        text_editor_write: new TextEditorWriteTool(browserFS, cwd),
        text_editor_str_replace: new TextEditorStrReplaceTool(browserFS, cwd),
        npm_add_package: new NpmAddPackageTool(browserFS, cwd),
        npm_remove_package: new NpmRemovePackageTool(browserFS, cwd),
      },
      system: `You are an AI assistant helping users build custom Nostr websites. You have access to tools that allow you to read, write, and manage files in the project, as well as build the project and manage npm packages.

Key capabilities:
- Read and write files in the project
- List directory contents
- Check if files exist
- Build the project using Vite
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
- Vite for building
- TailwindCSS for styling
- Nostrify for Nostr integration
- shadcn/ui components

When creating new components or pages, follow the existing patterns in the codebase.`
    });
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: AIMessage = {
      id: generateId(),
      role: 'user',
      content: input,
    };

    addMessage(userMessage);
    setInput('');
    setIsLoading(true);



    try {
      const aiMessages: AIMessage[] = [...messages, userMessage];
      updateMetadata('Shakespeare', `Processing your request for ${projectName}...`);

      await createAIChat(projectId, aiMessages);
    } catch (caughtError) {
      console.error('AI chat error:', caughtError);

      // Check if this is an AI API error that can be auto-fixed
      if (caughtError && typeof caughtError === 'object' && 'name' in caughtError &&
          (caughtError.name === 'AI_APICallError' || caughtError.name === 'AI_TypeValidationError' ||
           caughtError.name === 'ZodError')) {

        await handleAutoFix('api', caughtError);
        return; // Don't set isLoading(false) here as it's handled in handleAutoFix
      }

      // Handle other types of errors with the original logic
      const errorMessage: AIMessage = {
        id: generateId(),
        role: 'assistant',
        content: caughtError instanceof Error ? caughtError.message : 'Sorry, I encountered an error. Please try again.',
      };
      addMessage(errorMessage);
    } finally {
      setIsLoading(false);
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
          <GitHistoryDialog projectId={projectId} />
          <Button
            variant="outline"
            size="sm"
            className="gap-1 sm:gap-2 hover:bg-primary/10 hover:border-primary/20"
            onClick={runBuild}
            onMouseDown={handleFirstInteraction}
            disabled={isBuildLoading || isDeployLoading}
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
            disabled={isDeployLoading || isBuildLoading}
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
            // For assistant messages, find corresponding tool results
            const toolResults: CoreToolMessage[] = [];
            if (message.role === 'assistant') {
              // Look for tool messages that come after this assistant message
              for (let i = index + 1; i < messages.length; i++) {
                const nextMessage = messages[i];
                if (nextMessage?.role === 'tool') {
                  toolResults.push(nextMessage);
                } else if (nextMessage?.role === 'assistant' || nextMessage?.role === 'user') {
                  // Stop looking when we hit the next non-tool message
                  break;
                }
              }
            }

            return (
              <MessageItem
                key={index}
                message={message}
                userDisplayName="You"
                toolResults={toolResults}
              />
            );
          })}

          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <div className="flex space-x-1">
                  <div className="h-1 w-1 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="h-1 w-1 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="h-1 w-1 bg-current rounded-full animate-bounce"></div>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">Assistant</span>
                  <span className="text-xs text-muted-foreground">AI</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Thinking...
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFirstInteraction}
            placeholder="Ask me to add features, edit files, or build your project..."
            className="min-h-[60px] resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            onMouseDown={handleFirstInteraction}
            disabled={!input.trim() || isLoading}
            className="self-end"
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
