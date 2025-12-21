import { memo, useState } from 'react';
import { Streamdown } from 'streamdown';
import { Lightbulb, Loader2 } from 'lucide-react';
import type { AIMessage } from '@/lib/SessionManager';
import { cn } from '@/lib/utils';
import { UserMessage } from '@/components/UserMessage';
import { ImageLightbox } from '@/components/ImageLightbox';
import { ToolCallDisplay } from '@/components/ToolCallDisplay';
import OpenAI from 'openai';
import { useTheme } from '@/hooks/useTheme';
import { isEmptyMessage } from '@/lib/isEmptyMessage';

// Type guard to check if message has reasoning content
function hasReasoningContent(message: AIMessage): message is AIMessage & { reasoning_content: string } {
  return message.role === 'assistant' && 'reasoning_content' in message && typeof (message as { reasoning_content?: unknown }).reasoning_content === 'string';
}

interface AIMessageItemProps {
  message: AIMessage;
  isCurrentlyLoading?: boolean;
  toolCall?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall | undefined; // Tool call data passed from the assistant message
}

export const AIMessageItem = memo(({
  message,
  isCurrentlyLoading = false,
  toolCall,
}: AIMessageItemProps) => {
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const { displayTheme } = useTheme();

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

  // Special rendering for tool messages
  if (message.role === 'tool') {
    const content = getContent();

    // Get tool call arguments
    let toolArgs: Record<string, unknown> = {};
    let toolName = '';
    if (toolCall?.type === 'function') {
      toolName = toolCall.function.name;
      try {
        toolArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        toolArgs = {};
      }
    }

    return (
      <ToolCallDisplay
        toolName={toolName}
        toolArgs={toolArgs}
        state="completed"
        result={content}
      />
    );
  }

  // Regular rendering for non-tool messages
  if (message.role === 'user') {
    // User messages: right-aligned bubble without avatar/name
    // Extract text and image parts from message content
    const contentArray = Array.isArray(message.content) ? message.content : null;

    // Extract image URLs from content array
    const imageUrls = contentArray
      ? contentArray
        .filter(part => part.type === 'image_url')
        .map(part => (part as OpenAI.Chat.Completions.ChatCompletionContentPartImage).image_url.url)
      : [];

    return (
      <>
        <div className="flex justify-end py-6">
          <div className="max-w-[80%] bg-secondary rounded-2xl rounded-br-md px-4 py-3">
            <div className="text-sm break-words space-y-2">
              {/* Render text content and attachments first */}
              <UserMessage content={message.content} />
              {/* Render images after text and attachments */}
              {imageUrls.length > 0 && (
                <div className="space-y-2">
                  {imageUrls.map((url, index) => (
                    <div
                      key={index}
                      className="rounded-lg overflow-hidden border border-border cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setExpandedImageUrl(url)}
                    >
                      <img
                        src={url}
                        alt={`User uploaded image ${index + 1}`}
                        className="max-w-full h-auto max-h-96 object-contain"
                        loading="lazy"
                        onError={(e) => {
                          // Fallback if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = document.createElement('div');
                          fallback.className = 'p-2 text-xs text-muted-foreground bg-muted rounded';
                          fallback.textContent = `Image failed to load: ${url}`;
                          target.parentElement?.appendChild(fallback);
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Image expansion lightbox */}
        <ImageLightbox
          imageUrl={expandedImageUrl}
          onClose={() => setExpandedImageUrl(null)}
        />
      </>
    );
  }

  if (message.role !== 'assistant') {
    return null; // Only render assistant and user messages
  }

  // If the message is empty (no content or reasoning), render nothing
  if (isEmptyMessage({ ...message, tool_calls: [] })) {
    return null;
  }

  // Assistant messages: left-aligned without avatar/name
  const assistantContent = (
    <div className="flex">
      <div className="flex-1 min-w-0">
        <div className="text-sm space-y-3">
          {/* Reasoning content display */}
          {hasReasoningContent(message) && message.reasoning_content.trim() && (
            <div>
              <button
                onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1 text-xs",
                  "hover:bg-muted/30 rounded transition-colors duration-200"
                )}
              >
                {!getContent().trim() && isCurrentlyLoading ? (
                  <Loader2 className="h-3 w-3 text-muted-foreground flex-shrink-0 animate-spin" />
                ) : (
                  <Lightbulb className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )}
                <span className="text-muted-foreground font-medium flex-1 text-left">
                  Thinking
                </span>
              </button>

              {isReasoningExpanded && (
                <div className="mt-1 p-3 bg-muted/30 rounded border text-xs">
                  <div className="whitespace-pre-wrap break-words">
                    <Streamdown
                      className='size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0'
                      parseIncompleteMarkdown={isCurrentlyLoading}
                      shikiTheme={displayTheme === 'dark' ? 'github-dark' : 'github-light'}
                    >
                      {message.reasoning_content}
                    </Streamdown>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Main content display */}
          {getContent().trim() && (
            <div className="break-words">
              <Streamdown
                className='size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0'
                parseIncompleteMarkdown={isCurrentlyLoading}
                shikiTheme={displayTheme === 'dark' ? 'github-dark' : 'github-light'}
              >
                {getContent()}
              </Streamdown>
            </div>
          )}

          {/* Tool calls are now hidden from assistant messages */}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {assistantContent}

      {/* Image expansion lightbox */}
      <ImageLightbox
        imageUrl={expandedImageUrl}
        onClose={() => setExpandedImageUrl(null)}
      />
    </>
  );
});

AIMessageItem.displayName = 'AIMessageItem';