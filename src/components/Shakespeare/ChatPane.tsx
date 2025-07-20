import { FileSystemTree, WebContainer } from '@webcontainer/api';
import { useState, useRef, useEffect } from 'react';
import { CoreMessage, generateText, CoreUserMessage, CoreAssistantMessage, CoreToolMessage, generateId } from 'ai';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Send, Bot, User, Settings, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAISettings } from '@/contexts/AISettingsContext';
import { FsToolSet } from '@/lib/FsToolSet';
import { useFS } from '@/hooks/useFS';

const webcontainerPromise = WebContainer.boot();

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
  const { fs } = useFS();

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
    const webcontainer = await webcontainerPromise;

    const buildFileTree = async (dirPath: string): Promise<FileSystemTree> => {
      const tree: FileSystemTree = {};
      const items = await fs.readdir(dirPath);

      for (const item of items) {
        const itemPath = `${dirPath}/${item}`;
        const stat = await fs.stat(itemPath);

        if (stat.isDirectory()) {
          tree[item] = {
            directory: await buildFileTree(itemPath),
          };
        } else {
          const content = await fs.readFile(itemPath, 'utf8');
          tree[item] = {
            file: {
              contents: content,
            },
          };
        }
      }

      return tree;
    };

    const fsTree = await buildFileTree(`/projects/${projectId}`);
    await webcontainer.mount(fsTree);

    // Install dependencies and build
    const proc = await webcontainer.spawn('npm', ['i']);
    await proc.exit;

    const proc2 = await webcontainer.spawn('npm', ['run', 'build']);
    await proc2.exit;

    // Copy "dist" out of the webcontainer back to the project directory
    const copyDist = async () => {
      try {
        // Read the dist directory from webcontainer
        const distContents = await webcontainer.fs.readdir('dist', { withFileTypes: true });

        // Create dist directory in project if it doesn't exist
        const distPath = `/projects/${projectId}/dist`;
        try {
          await fs.mkdir(distPath);
        } catch {
          // Directory might already exist, that's fine
        }

        // Helper function to copy directory recursively
        const copyDirectory = async (sourcePath: string, destPath: string) => {
          try {
            console.log(`Copying directory: ${sourcePath}`);
            const items = await webcontainer.fs.readdir(sourcePath, { withFileTypes: true });
            console.log(`Found ${items.length} items in ${sourcePath}`);

            for (const item of items) {
              const sourceItemPath = `${sourcePath}/${item.name}`;
              const destItemPath = `${destPath}/${item.name}`;

              try {
                if (item.isDirectory()) {
                  console.log(`Creating directory: ${destItemPath}`);
                  try {
                    await fs.mkdir(destItemPath);
                  } catch {
                    // Directory might already exist
                  }
                  await copyDirectory(sourceItemPath, destItemPath);
                } else {
                  console.log(`Copying file: ${sourceItemPath} -> ${destItemPath}`);
                  const content = await webcontainer.fs.readFile(sourceItemPath);
                  await fs.writeFile(destItemPath, content);
                }
              } catch (itemError) {
                console.warn(`Failed to copy item ${item.name}:`, itemError);
              }
            }
          } catch (error) {
            console.warn(`Failed to copy ${sourcePath}:`, error);
          }
        };

        // Copy each package in dist
        for (const item of distContents) {
          const sourcePath = `dist/${item.name}`;
          const destPath = `${distPath}/${item.name}`;

          try {
            if (item.isDirectory()) {
              console.log(`Processing directory: ${item.name}`);
              try {
                await fs.mkdir(destPath);
              } catch {
                // Directory might already exist
              }
              await copyDirectory(sourcePath, destPath);
            } else {
              console.log(`Processing file: ${item.name}`);
              const content = await webcontainer.fs.readFile(sourcePath);
              await fs.writeFile(destPath, content);
            }
          } catch (itemError) {
            console.warn(`Failed to process ${item.name}:`, itemError);
          }
        }

        console.log('Successfully copied node_modules from webcontainer');
      } catch (error) {
        console.error('Failed to copy node_modules:', error);
      }
    };

    await copyDist();
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
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

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
    const toolSet = new FsToolSet(fs, `/projects/${projectId}`);

    return generateText({
      model: provider,
      messages,
      maxSteps: 100,
      onStepFinish(stepResult) {
        addMessages(stepResult.response.messages);
      },
      tools: {
        readFile: toolSet.readFile,
        writeFile: toolSet.writeFile,
      },
      system: `You are an AI assistant helping users build custom Nostr websites. You have access to tools that allow you to read, write, and manage files in the project, as well as build the project.

Key capabilities:
- Read and write files in the project
- List directory contents
- Check if files exist
- Build the project using Vite
- Get project structure overview
- Search through files

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
        <div className="border-b px-4 py-3 flex justify-between items-center">
          <div>
            <h2 className="font-semibold">AI Assistant</h2>
            <p className="text-sm text-muted-foreground">Chat to build your project</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
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

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Bot className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold mb-2">AI Assistant Not Configured</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Please configure your AI settings to start building with AI assistance.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
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

  const renderPart = (part: (CoreUserMessage | CoreAssistantMessage | CoreToolMessage)['content'][0]) => {
    if (typeof part === 'string') {
      return <div className="whitespace-pre-wrap text-sm">{part}</div>;
    }
    switch (part.type) {
      case 'text':
        return <div className="whitespace-pre-wrap text-sm">{part.text}</div>;
      case 'tool-call':
        return <div className="text-sm text-blue-500">{part.toolName}</div>;
      case 'tool-result':
        return <div className="text-sm">{JSON.stringify(part.result)}</div>;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b px-4 py-3 flex justify-between items-center">
        <div>
          <h2 className="font-semibold">AI Assistant</h2>
          <p className="text-sm text-muted-foreground">Chat to build your project</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={runBuild}
        >
          <Play className="h-4 w-4" />
          Build
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'flex gap-2 max-w-[80%]',
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  {message.role === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <Card
                  className={cn(
                    'px-4 py-2',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  {typeof message.content === 'string' ? (
                    <div className="whitespace-pre-wrap text-sm">
                      {message.content}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-sm">
                      {[...message.content].map((part, i) => (
                        <span key={i} className="block">
                          {renderPart(part)}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <Card className="px-4 py-2 bg-muted">
                <div className="flex space-x-1">
                  <div className="h-2 w-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="h-2 w-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="h-2 w-2 bg-current rounded-full animate-bounce"></div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

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
