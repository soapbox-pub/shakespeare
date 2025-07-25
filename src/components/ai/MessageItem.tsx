import { memo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AssistantContent } from '@/components/ai/AssistantContent';
import { Bot, User } from 'lucide-react';
import type { CoreUserMessage, CoreAssistantMessage, CoreToolMessage } from 'ai';

interface MessageItemProps {
  message: (CoreUserMessage | CoreAssistantMessage | CoreToolMessage) & { id: string };
  userDisplayName?: string;
  userProfileImage?: string;
  toolResults?: CoreToolMessage[];
}

export const MessageItem = memo(({
  message,
  userDisplayName = 'You',
  userProfileImage,
  toolResults = []
}: MessageItemProps) => {
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
            {message.role === 'user' ? userDisplayName : 'Assistant'}
          </span>
          <span className="text-xs text-muted-foreground">
            {message.role === 'user' ? 'User' : 'AI'}
          </span>
        </div>
        <div className="text-sm">
          {message.role === 'user' ? (
            <div className="whitespace-pre-wrap break-words">
              {typeof message.content === 'string' ? message.content :
                message.content.map((part, _i) => {
                  if (part.type === 'text') return part.text;
                  return null;
                }).join('')
              }
            </div>
          ) : message.role === 'assistant' ? (
            <AssistantContent
              content={(message as CoreAssistantMessage).content}
              toolResults={toolResults}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';