import { FileText, File } from 'lucide-react';
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

  // Regular expression to match "Added file: /tmp/<filename>" patterns
  const filePattern = /^Added file: (\/tmp\/[^\s\n]+)$/;

  // Process each content part and categorize as text or file
  const processedParts: Array<{ type: 'text' | 'file'; content: string; filepath?: string }> = [];

  contentParts.forEach(part => {
    const text = part.text.trim();
    const match = text.match(filePattern);

    if (match) {
      // This is a file attachment
      const filepath = match[1]; // "/tmp/filename.txt"
      processedParts.push({ type: 'file', content: text, filepath });
    } else if (text) {
      // This is regular text content
      processedParts.push({ type: 'text', content: text });
    }
  });

  // If no content, return empty
  if (processedParts.length === 0) {
    return null;
  }

  const getFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();

    // Return FileText icon for text-like files, File icon for others
    const textExtensions = ['txt', 'md', 'json', 'js', 'ts', 'jsx', 'tsx', 'css', 'html', 'xml', 'yml', 'yaml'];

    if (extension && textExtensions.includes(extension)) {
      return <FileText className="h-3 w-3" />;
    }

    return <File className="h-3 w-3" />;
  };

  const getFileName = (filepath: string) => {
    return filepath.split('/').pop() || filepath;
  };

  return (
    <div className="space-y-2">
      {processedParts.map((part, index) => {
        if (part.type === 'text') {
          return (
            <div key={index} className="whitespace-pre-wrap">
              {part.content}
            </div>
          );
        } else {
          const filename = getFileName(part.filepath!);
          return (
            <div key={index} className="flex items-center gap-2">
              <Badge variant="secondary" className="flex items-center gap-1.5 px-2 py-1">
                {getFileIcon(filename)}
                <span className="text-xs font-medium">{filename}</span>
              </Badge>
            </div>
          );
        }
      })}
    </div>
  );
}