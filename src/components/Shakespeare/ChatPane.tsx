import { useState, useRef, useEffect } from 'react';
import { tool, CoreMessage, generateText, CoreUserMessage, CoreAssistantMessage, CoreToolMessage } from 'ai';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Send, Bot, User, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAISettings } from '@/contexts/AISettingsContext';
import { contextualAITools } from '@/lib/ai-tools';
import { z } from 'zod';

interface ChatPaneProps {
  projectId: string;
  projectName: string;
}

export function ChatPane({ projectId, projectName }: ChatPaneProps) {
  const [messages, setMessages] = useState<(CoreUserMessage | CoreAssistantMessage | CoreToolMessage)[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { settings, isConfigured } = useAISettings();

  useEffect(() => {
    // Set the current project ID for contextual AI tools
    contextualAITools.setCurrentProjectId(projectId);

    // Add welcome message
    setMessages([
      {
        role: 'assistant',
        content: `Hello! I'm here to help you build "${projectName}". I can help you edit files, add new features, and build your Nostr website. What would you like to work on?`,
      },
    ]);
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

    const fileOperationSchema = z.object({
      filePath: z.string(),
      content: z.string().optional(),
    });

    const buildSchema = z.object({});

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
        setMessages((prev) => [...prev, ...[...stepResult.response.messages]]);
      },
      tools: {
        readFile: tool({
          description: 'Read the contents of a file in the project',
          parameters: fileOperationSchema,
          execute: async ({ filePath }) => {
            return await contextualAITools.readFile(filePath);
          },
        }),
        writeFile: tool({
          description: 'Write content to a file in the project',
          parameters: fileOperationSchema,
          execute: async ({ filePath, content }) => {
            return await contextualAITools.writeFile(filePath, content || '');
          },
        }),
        deleteFile: tool({
          description: 'Delete a file from the project',
          parameters: fileOperationSchema,
          execute: async ({ filePath }) => {
            return await contextualAITools.deleteFile(filePath);
          },
        }),
        listFiles: tool({
          description: 'List files in a directory',
          parameters: fileOperationSchema,
          execute: async ({ filePath }) => {
            return await contextualAITools.listFiles(filePath);
          },
        }),
        fileExists: tool({
          description: 'Check if a file exists',
          parameters: fileOperationSchema,
          execute: async ({ filePath }) => {
            return await contextualAITools.fileExists(filePath);
          },
        }),
        buildProject: tool({
          description: 'Build the project using Vite',
          parameters: buildSchema,
          execute: async () => {
            return await contextualAITools.buildProject();
          },
        }),
        getProjectStructure: tool({
          description: 'Get the complete file structure of the project',
          parameters: buildSchema,
          execute: async () => {
            return await contextualAITools.getProjectStructure();
          },
        }),
        searchFiles: tool({
          description: 'Search for files containing specific text',
          parameters: z.object({
            query: z.string(),
          }),
          execute: async ({ query }) => {
            return await contextualAITools.searchFiles(query);
          },
        }),
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

    const userMessage: CoreUserMessage = {
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const aiMessages: (CoreUserMessage | CoreAssistantMessage | CoreToolMessage)[] = [
        ...messages,
        { role: 'user', content: input },
      ];

      await createAIChat(projectId, aiMessages);
    } catch (error) {
      console.error('AI chat error:', error);
      const errorMessage: CoreMessage = {
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
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
          onClick={() => {
            const event = new CustomEvent('openAISettings');
            window.dispatchEvent(event);
          }}
        >
          <Settings className="h-4 w-4" />
          Settings
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
