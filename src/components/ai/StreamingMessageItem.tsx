import { memo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bot, User, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Response } from '@/components/ai-elements/response';
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
            <div>
              {/* Handle assistant content */}
              {typeof message.content === 'string' ? (
                <div className="mb-2 prose prose-sm max-w-none dark:prose-invert">
                  <Response>{message.content}</Response>
                  {message.isStreaming && (
                    <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
                  )}
                </div>
              ) : Array.isArray(message.content) ? (
                <div className="space-y-2">
                  {message.content.map((part, index) => {
                    if (part.type === 'text') {
                      return (
                        <div className="mb-2 prose prose-sm max-w-none dark:prose-invert">
                          <Response>{part.text}</Response>
                          {message.isStreaming && (
                            <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
                          )}
                        </div>
                      );
                    } else if (part.type === 'tool-call') {
                      return (
                        <AssistantContent
                          key={index}
                          content={[part]}
                          toolResults={[]}
                        />
                      );
                    } else if (part.type === 'tool-result') {
                      return (
                        <AssistantContent
                          key={index}
                          content={[]}
                          toolResults={[{
                            role: 'tool',
                            content: [part]
                          }]}
                        />
                      );
                    }
                    return null;
                  })}
                  {message.isStreaming && (
                    <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
                  )}
                </div>
              ) : (
                /* Streaming indicator for when there's no content yet */
                message.isStreaming && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="flex space-x-1">
                      <div className="h-1 w-1 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="h-1 w-1 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="h-1 w-1 bg-current rounded-full animate-bounce"></div>
                    </div>
                    <span className="text-xs">Thinking...</span>
                  </div>
                )
              )}
            </div>
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