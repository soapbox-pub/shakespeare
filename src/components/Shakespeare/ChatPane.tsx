
import { useState, useRef, useEffect } from 'react';
import { CoreMessage, generateText, CoreUserMessage, CoreAssistantMessage, CoreToolMessage, generateId } from 'ai';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Settings, Play, CloudUpload } from 'lucide-react';
import { useAISettings } from '@/hooks/useAISettings';
import { useFS } from '@/hooks/useFS';
import { useJSRuntime } from '@/hooks/useJSRuntime';
import { copyDirectory } from '@/lib/copyFiles';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { bytesToHex } from 'nostr-tools/utils';
import { MessageItem } from '@/components/ai/MessageItem';
import { TextEditorViewTool } from '@/lib/tools/TextEditorViewTool';
import { TextEditorWriteTool } from '@/lib/tools/TextEditorWriteTool';
import { TextEditorStrReplaceTool } from '@/lib/tools/TextEditorStrReplaceTool';
import { NpmAddPackageTool } from '@/lib/tools/NpmAddPackageTool';
import { NpmRemovePackageTool } from '@/lib/tools/NpmRemovePackageTool';

interface ChatPaneProps {
  projectId: string;
  projectName: string;
}

type AIMessage = (CoreUserMessage | CoreAssistantMessage | CoreToolMessage) & { id: string };

export function ChatPane({ projectId, projectName }: ChatPaneProps) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { settings, isConfigured } = useAISettings();
  const { fs: browserFS } = useFS();
  const { runtime } = useJSRuntime();

  const addMessage = (message: AIMessage) => {
    setMessages((prev) => {
      const messageMap = new Map(prev.map(m => [m.id, m])).set(message.id, message);
      return Array.from(messageMap.values());
    });
  };

  const addMessages = (newMessages: AIMessage[]) => {
    setMessages((prev) => {
      const messageMap = new Map(prev.map(m => [m.id, m]));
      newMessages.forEach(msg => messageMap.set(msg.id, msg));
      return Array.from(messageMap.values());
    });
  };

  const runBuild = async () => {
    console.log('Running build for project:', projectId);
    const runtimeFS = await runtime.fs();

    // Copy project files to runtime filesystem
    const projectPath = `/projects/${projectId}`;
    try {
      await copyDirectory(browserFS, runtimeFS, projectPath, '.');
      console.log('Successfully copied project to runtime');
    } catch (error) {
      console.error('Failed to copy project to runtime:', error);
      return;
    }

    // Install dependencies and build
    const proc = await runtime.spawn('npm', ['i']);
    await proc.exit;

    const proc2 = await runtime.spawn('npm', ['run', 'build']);
    await proc2.exit;

    // Copy "dist" directory from runtime back to project filesystem
    const distPath = `/projects/${projectId}/dist`;
    try {
      await copyDirectory(runtimeFS, browserFS, 'dist', distPath);
      console.log('Successfully copied dist from runtime');
    } catch (error) {
      console.error('Failed to copy dist:', error);
    }
  };

  const runDeploy = async () => {
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

    return generateText({
      model: provider,
      messages,
      maxSteps: 100,
      onStepFinish(stepResult) {
        console.log(stepResult);
        addMessages(stepResult.response.messages);
      },
      tools: {
        text_editor_view: new TextEditorViewTool(browserFS, `/projects/${projectId}`),
        text_editor_write: new TextEditorWriteTool(browserFS, `/projects/${projectId}`),
        text_editor_str_replace: new TextEditorStrReplaceTool(browserFS, `/projects/${projectId}`),
        npm_add_package: new NpmAddPackageTool(browserFS, `/projects/${projectId}`),
        npm_remove_package: new NpmRemovePackageTool(browserFS, `/projects/${projectId}`),
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

      await createAIChat(projectId, aiMessages);
    } catch (error) {
      console.error('AI chat error:', error);
      const errorMessage: AIMessage = {
        id: generateId(),
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.',
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
            className="gap-1 sm:gap-2 hover:bg-primary/10 hover:border-primary/20"
            onClick={runBuild}
          >
            <Play className="h-4 w-4" />
            <span className="hidden sm:inline">Build</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 sm:gap-2 hover:bg-accent/10 hover:border-accent/20"
            onClick={runDeploy}
          >
            <CloudUpload className="h-4 w-4" />
            <span className="hidden sm:inline">Deploy</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-scroll overflow-x-hidden" ref={scrollAreaRef}>
        <div className="p-4 space-y-4">
          {messages.map((message, index) => (
            <MessageItem
              key={index}
              message={message}
              userDisplayName="You"
            />
          ))}

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
            placeholder="Ask me to add features, edit files, or build your project..."
            className="min-h-[60px] resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
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
