import { FileText, File } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface UserMessageProps {
  content: string;
}

/**
 * Component to render user messages nicely
 * Detects "File added to /tmp/<filename>" patterns and renders them as badges
 */
export function UserMessage({ content }: UserMessageProps) {
  // Regular expression to match "File added to /tmp/<filename>" patterns
  const filePattern = /File added to (\/tmp\/[^\s\n]+)/g;

  // Split content by file attachments to render them separately
  const parts: Array<{ type: 'text' | 'file'; content: string; filepath?: string }> = [];
  let lastIndex = 0;
  let match;

  while ((match = filePattern.exec(content)) !== null) {
    // Add text before the file attachment
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);
      if (textBefore.trim()) {
        parts.push({ type: 'text', content: textBefore });
      }
    }

    // Add the file attachment
    const fullMatch = match[0]; // "File added to /tmp/filename.txt"
    const filepath = match[1]; // "/tmp/filename.txt"
    parts.push({ type: 'file', content: fullMatch, filepath });

    lastIndex = match.index + fullMatch.length;
  }

  // Add remaining text after the last file attachment
  if (lastIndex < content.length) {
    const remainingText = content.slice(lastIndex);
    if (remainingText.trim()) {
      parts.push({ type: 'text', content: remainingText });
    }
  }

  // If no file attachments found, render as normal text
  if (parts.length === 0) {
    return <span className="whitespace-pre-wrap">{content}</span>;
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
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return (
            <span key={index} className="whitespace-pre-wrap">
              {part.content}
            </span>
          );
        } else {
          const filename = getFileName(part.filepath!);
          return (
            <div key={index} className="flex items-center gap-2">
              <Badge variant="secondary" className="flex items-center gap-1.5 px-2 py-1">
                {getFileIcon(filename)}
                <span className="text-xs font-medium">{filename}</span>
                <span className="text-xs text-muted-foreground">added to {part.filepath}</span>
              </Badge>
            </div>
          );
        }
      })}
    </div>
  );
}