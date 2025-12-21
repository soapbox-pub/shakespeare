import { Paperclip } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type OpenAI from 'openai';

interface UserMessageProps {
  content: string | Array<OpenAI.Chat.Completions.ChatCompletionContentPartText>;
}

/**
 * Component to render user messages nicely
 * Handles both string content and array content (text parts)
 * Detects "Added file: /tmp/<filename>" patterns and renders them as badges
 */
export function UserMessage({ content }: UserMessageProps) {
  // Convert content to array format for uniform processing
  const contentParts = typeof content === 'string'
    ? [{ type: 'text' as const, text: content }]
    : content.filter(part => part.type === 'text') as Array<{ type: 'text'; text: string }>;

  // Process each content part and categorize as text or file
  const processedParts: Array<{ type: 'text' | 'file'; content: string; filepath?: string }> = [];

  contentParts.forEach(part => {
    const text = part.text.trim();

    // Matches the pattern anywhere in the text
    // Regular expression to match "Added file: <filename>" patterns
    const filePattern = /^Added file: (\/[^\s\n]+$)/g;
    
    // Find all file patterns in this text part
    const fileMatches = [...text.matchAll(filePattern)].map(match => ({
      filepath: match[1], // "/tmp/filename.txt"
      index: match.index,
      length: match[0].length,
    }));

    if (fileMatches.length > 0) {
      // Split text around file patterns and process each segment
      let lastIndex = 0;
      
      fileMatches.forEach((fileMatch) => {
        // Add text before the file pattern
        if (fileMatch.index > lastIndex) {
          const textBefore = text.substring(lastIndex, fileMatch.index).trim();
          if (textBefore) {
            processedParts.push({ type: 'text', content: textBefore });
          }
        }
        
        // Add the file attachment badge (without showing "Added file:" text)
        processedParts.push({ 
          type: 'file', 
          content: '', // Empty - badge will show filename only
          filepath: fileMatch.filepath 
        });
        
        lastIndex = fileMatch.index + fileMatch.length;
      });
      
      // Add remaining text after the last file pattern
      if (lastIndex < text.length) {
        const textAfter = text.substring(lastIndex).trim();
        if (textAfter) {
          processedParts.push({ type: 'text', content: textAfter });
        }
      }
    } else if (text) {
      // No file patterns found, treat as regular text
      processedParts.push({ type: 'text', content: text });
    }
  });

  // If no content, return empty
  if (processedParts.length === 0) {
    return null;
  }

  const getFileName = (filepath: string) => {
    return filepath.split('/').pop() || filepath;
  };

  return (
    <div className="space-y-2">
      {processedParts.map((part, index) => {
        if (part.type === 'text') {
          // Only render text if it has content
          if (!part.content.trim()) return null;
          return (
            <div key={index} className="whitespace-pre-wrap">
              {part.content}
            </div>
          );
        } else {
          // Render file attachment badge (no "Added file:" text)
          const filename = getFileName(part.filepath!);
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
      })}
    </div>
  );
}