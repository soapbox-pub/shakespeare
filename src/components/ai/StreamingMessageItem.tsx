import { memo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bot, User, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Response } from '@/components/ai-elements/response';
import { StreamingMessage } from '@/hooks/useStreamingChat';
import { AssistantContent } from '@/components/ai/AssistantContent';
import { CoreToolMessage } from 'ai';

interface StreamingMessageItemProps {
  message: StreamingMessage;
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
            {message.role === 'user' ? userDisplayName : 'Assistant'}
          </span>
          <span className="text-xs text-muted-foreground">
            {message.role === 'user' ? 'User' : 'AI'}
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
              {message.content}
            </div>
          ) : message.role === 'assistant' ? (
            <div>
              {/* Text content */}
              {message.content && (
                <div className="mb-2">
                  {message.isStreaming ? (
                    <Response>{message.content}</Response>
                  ) : (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <Response>{message.content}</Response>
                    </div>
                  )}
                  {message.isStreaming && (
                    <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
                  )}
                </div>
              )}
              
              {/* Tool calls */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="space-y-2">
                  {message.toolCalls.map((toolCall) => {
                    // Create a mock CoreToolMessage for compatibility with AssistantContent
                    const mockToolResults: CoreToolMessage[] = message.toolResults ? [
                      {
                        role: 'tool',
                        content: message.toolResults
                          .filter(result => result.toolCallId === toolCall.id)
                          .map(result => ({
                            type: 'tool-result' as const,
                            toolCallId: result.toolCallId,
                            toolName: result.toolName,
                            output: {
                              type: 'text' as const,
                              value: typeof result.output === 'string' ? result.output : JSON.stringify(result.output)
                            }
                          }))
                      }
                    ] : [];

                    return (
                      <AssistantContent
                        key={toolCall.id}
                        content={[
                          {
                            type: 'tool-call',
                            toolCallId: toolCall.id,
                            toolName: toolCall.toolName,
                            input: toolCall.input
                          }
                        ]}
                        toolResults={mockToolResults}
                      />
                    );
                  })}
                </div>
              )}
              
              {/* Streaming indicator for when there's no content yet */}
              {message.isStreaming && !message.content && !message.toolCalls?.length && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="flex space-x-1">
                    <div className="h-1 w-1 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="h-1 w-1 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="h-1 w-1 bg-current rounded-full animate-bounce"></div>
                  </div>
                  <span className="text-xs">Thinking...</span>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});

StreamingMessageItem.displayName = 'StreamingMessageItem';