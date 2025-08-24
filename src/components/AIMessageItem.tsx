import { memo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bot, User, Square } from 'lucide-react';
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
            {message.content}
          </div>
        </div>
      </div>
    </div>
  );
});

AIMessageItem.displayName = 'AIMessageItem';