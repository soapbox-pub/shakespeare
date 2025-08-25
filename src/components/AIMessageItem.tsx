import { memo } from 'react';
import { Streamdown } from 'streamdown';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bot, User, Square, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIMessage } from '@/hooks/useAIChat';

interface AIMessageItemProps {
  message: AIMessage;
  userDisplayName?: string;
  userProfileImage?: string;
  isCurrentlyLoading?: boolean;
  onStopGeneration?: () => void;
}

export const AIMessageItem = memo(({
  message,
  userDisplayName = 'You',
  userProfileImage,
  isCurrentlyLoading = false,
  onStopGeneration
}: AIMessageItemProps) => {
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
        ) : message.role === 'tool' ? (
          <>
            <AvatarFallback>
              <Wrench className="h-4 w-4" />
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

          {/* Display tool calls if present */}
          {'tool_calls' in message && message.tool_calls && (
            <div className="mt-2 space-y-2">
              {message.tool_calls.map((toolCall, index) => (
                <div key={index} className="bg-muted p-2 rounded text-xs">
                  <div className="font-medium">
                    Tool Call: {toolCall.type === 'function' ? toolCall.function.name : 'Unknown'}
                  </div>
                  <div className="text-muted-foreground">
                    {toolCall.type === 'function' ? toolCall.function.arguments : 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

AIMessageItem.displayName = 'AIMessageItem';