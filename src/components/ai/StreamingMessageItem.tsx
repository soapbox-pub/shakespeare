import { memo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bot, User, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatMessage } from '@/hooks/useStreamingChat';
import { AssistantContent } from '@/components/ai/AssistantContent';

interface StreamingMessageItemProps {
  message: ChatMessage;
  userDisplayName?: string;
  userProfileImage?: string;
  isCurrentlyStreaming?: boolean;
  onStopStreaming?: () => void;
}

export const StreamingMessageItem = memo(({
  message,
  userDisplayName = 'You',
  userProfileImage,
  isCurrentlyStreaming = false,
  onStopStreaming
}: StreamingMessageItemProps) => {
  // Don't render tool messages as separate items - they're integrated into assistant messages
  if (message.role === 'tool') {
    return null;
  }

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
            {message.role === 'user' ? userDisplayName : message.role === 'assistant' ? 'Assistant' : 'System'}
          </span>
          <span className="text-xs text-muted-foreground">
            {message.role === 'user' ? 'User' : message.role === 'assistant' ? 'AI' : 'System'}
          </span>
          {isCurrentlyStreaming && onStopStreaming && (
            <Button
              variant="outline"
              size="sm"
              onClick={onStopStreaming}
              className="ml-auto gap-1 h-6 px-2 text-xs"
            >
              <Square className="h-3 w-3" />
              Stop
            </Button>
          )}
        </div>
        <div className="text-sm">
          {message.role === 'user' ? (
            <div className="whitespace-pre-wrap break-words">
              {typeof message.content === 'string' ? message.content : 
               Array.isArray(message.content) ? 
                 message.content.map(part => part.type === 'text' ? part.text : '').join('') : 
                 ''}
            </div>
          ) : message.role === 'assistant' ? (
            <AssistantContent content={message.content} />
          ) : message.role === 'system' ? (
            <div className="whitespace-pre-wrap break-words text-muted-foreground">
              {typeof message.content === 'string' ? message.content : ''}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});

StreamingMessageItem.displayName = 'StreamingMessageItem';