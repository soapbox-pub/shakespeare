import { Paperclip } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type OpenAI from 'openai';

interface UserMessageProps {
  content: string | Array<OpenAI.Chat.Completions.ChatCompletionContentPart>;
}

/**
 * Component to render user messages nicely
 * Handles both string content and array content (text parts)
 * Detects "Added file: /tmp/<filename>" patterns and renders them as badges
 */
export function UserMessage({ content }: UserMessageProps) {
  // Convert content to array format for uniform processing
  const parts = typeof content === 'string'
    ? [{ type: 'text' as const, text: content }]
    : content.filter(part => part.type === 'text');

  // If no content, return empty
  if (parts.length === 0) {
    return null;
  }

  const getFileName = (filepath: string) => {
    return filepath.split('/').pop() || filepath;
  };

  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        if (part.type === 'text') {
          // Only render text if it has content
          if (!part.text.trim()) return null;

          // Detect "Added file: <filename>" pattern
          const fileAddedMatch = /^Added file: (\/[^\s\n]+$)/g.exec(part.text);
          if (fileAddedMatch && fileAddedMatch[1]) {
            const path = fileAddedMatch[1];
            const filename = getFileName(path);
            return (
              <div key={index} className="flex items-center gap-2 max-w-full min-w-0">
                <Badge variant="secondary" className="inline-flex items-center gap-1.5 px-2 py-1 max-w-full">
                  <span className="flex-shrink-0">
                    <Paperclip className="h-3 w-3" />
                  </span>
                  <span className="text-xs font-medium truncate min-w-0" title={filename}>
                    {filename}
                  </span>
                </Badge>
              </div>
            );
          }

          // Regular text rendering
          return (
            <div key={index} className="whitespace-pre-wrap">
              {part.text}
            </div>
          );
        } else {
          // Unsupported content type
          return (
            <div key={index} className="text-sm text-red-500">
              [Unsupported content type]
            </div>
          );
        }
      })}
    </div>
  );
}