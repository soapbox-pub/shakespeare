import { memo, useState } from 'react';
import { Streamdown } from 'streamdown';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bot, User, Square, Wrench, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIMessage } from '@/hooks/useAIChat';
import { cn } from '@/lib/utils';
import OpenAI from 'openai';

interface AIMessageItemProps {
  message: AIMessage;
  userDisplayName?: string;
  userProfileImage?: string;
  isCurrentlyLoading?: boolean;
  onStopGeneration?: () => void;
  toolCall?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall | undefined; // Tool call data passed from the assistant message
}

export const AIMessageItem = memo(({
  message,
  userDisplayName = 'You',
  userProfileImage,
  isCurrentlyLoading = false,
  onStopGeneration,
  toolCall
}: AIMessageItemProps) => {
  const [isToolExpanded, setIsToolExpanded] = useState(false);

  // Get display name based on role
  const getDisplayName = () => {
    switch (message.role) {
      case 'user':
        return userDisplayName;
      case 'assistant':
        return 'Assistant';
      case 'system':
        return 'System';
      case 'tool':
        return 'Tool';
      default:
        return 'Unknown';
    }
  };

  // Get role label for display
  const getRoleLabel = () => {
    switch (message.role) {
      case 'user':
        return 'User';
      case 'assistant':
        return 'AI';
      case 'system':
        return 'System';
      case 'tool':
        return 'Tool';
      default:
        return message.role;
    }
  };

  // Get content to display
  const getContent = () => {
    if (typeof message.content === 'string') {
      return message.content;
    }
    if (Array.isArray(message.content)) {
      // Handle array content (like images, text blocks)
      return message.content
        .map(item => {
          if (typeof item === 'string') return item;
          if (item.type === 'text') return item.text;
          if (item.type === 'image_url') return `[Image: ${item.image_url.url}]`;
          return '[Unknown content]';
        })
        .join('\n');
    }
    return '';
  };

  // Get tool name and description from tool call data
  const getToolInfo = () => {
    if (message.role === 'tool' && toolCall) {
      if (toolCall.type === 'function') {
        const toolName = toolCall.function.name;
        let args;

        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = {};
        }

        // Generate nice titles based on tool name and arguments
        switch (toolName) {
          case 'text_editor_view':
            return {
              title: args.path ? `View ${args.path}` : 'View File',
              subtitle: args.start_line || args.end_line ?
                `Lines ${args.start_line || 1}-${args.end_line || 'end'}` :
                'Full file'
            };
          case 'text_editor_write':
            return {
              title: args.path ? `Write ${args.path}` : 'Write File',
              subtitle: 'Create or overwrite file'
            };
          case 'text_editor_str_replace':
            return {
              title: args.path ? `Edit ${args.path}` : 'Edit File',
              subtitle: 'Replace text'
            };
          case 'npm_add_package':
            return {
              title: args.name ? `Install ${args.name}` : 'Install Package',
              subtitle: args.dev ? 'Dev dependency' : 'Dependency'
            };
          case 'npm_remove_package':
            return {
              title: args.name ? `Remove ${args.name}` : 'Remove Package',
              subtitle: 'Uninstall package'
            };
          case 'git_commit':
            return {
              title: 'Git Commit',
              subtitle: args.message || 'Commit changes'
            };
          default:
            return {
              title: toolName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              subtitle: 'Tool execution'
            };
        }
      }
    }

    // Fallback to extracting from content
    if (message.role === 'tool') {
      const content = getContent();
      const lines = content.split('\n');
      const firstLine = lines[0];

      if (firstLine && firstLine.length < 100) {
        return {
          title: firstLine.replace(/^(Error |Tool |Executing |Result: )/i, '').trim(),
          subtitle: 'Tool result'
        };
      }

      return {
        title: 'Tool Result',
        subtitle: 'Execution result'
      };
    }

    return {
      title: 'Tool',
      subtitle: ''
    };
  };

  // Special rendering for tool messages
  if (message.role === 'tool') {
    const content = getContent();
    const toolInfo = getToolInfo();

    return (
      <div className="ml-11 -mt-2"> {/* ml-11 to align with assistant message content, -mt-2 to make it snug */}
        <button
          onClick={() => setIsToolExpanded(!isToolExpanded)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-1.5 text-xs",
            "bg-muted/50 hover:bg-muted/70 rounded border",
            "transition-colors duration-200"
          )}
        >
          {isToolExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
          <Wrench className="h-3 w-3 text-muted-foreground" />
          <div className="flex flex-col items-start min-w-0 flex-1">
            <span className="text-muted-foreground font-medium truncate">
              {toolInfo.title}
            </span>
            {toolInfo.subtitle && (
              <span className="text-muted-foreground/70 text-xs truncate">
                {toolInfo.subtitle}
              </span>
            )}
          </div>
        </button>

        {isToolExpanded && (
          <div className="mt-1 p-3 bg-muted/30 rounded border text-xs">
            <div className="whitespace-pre-wrap break-words font-mono">
              {content}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Regular rendering for non-tool messages
  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 flex-shrink-0">
        {message.role === 'user' ? (
          <>
            <AvatarImage src={userProfileImage} alt={userDisplayName} />
            <AvatarFallback>
              <User className="h-4 w-4" />
            </AvatarFallback>
          </>
        ) : (
          <>
            <AvatarFallback>
              <Bot className="h-4 w-4" />
            </AvatarFallback>
          </>
        )}
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">
            {getDisplayName()}
          </span>
          <span className="text-xs text-muted-foreground">
            {getRoleLabel()}
          </span>
          {isCurrentlyLoading && onStopGeneration && (
            <Button
              variant="outline"
              size="sm"
              onClick={onStopGeneration}
              className="ml-auto gap-1 h-6 px-2 text-xs"
            >
              <Square className="h-3 w-3" />
              Stop
            </Button>
          )}
        </div>
        <div className="text-sm">
          <div className="whitespace-pre-wrap break-words">
            <Streamdown
              className='size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0'
              parseIncompleteMarkdown={isCurrentlyLoading}
            >
              {getContent()}
            </Streamdown>
          </div>

          {/* Tool calls are now hidden from assistant messages */}
        </div>
      </div>
    </div>
  );
});

AIMessageItem.displayName = 'AIMessageItem';