import { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isMediaFile } from '@/lib/fileUtils';

interface FileEditorProps {
  filePath: string;
  content: string;
  onContentChange: (content: string) => void;
  isLoading: boolean;
  projectId?: string;
}

export function FileEditor({ filePath, content, onContentChange, isLoading, projectId }: FileEditorProps) {
  const [editedContent, setEditedContent] = useState(content);
  const isMedia = isMediaFile(filePath);

  useEffect(() => {
    setEditedContent(content);
  }, [content, filePath]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setEditedContent(newContent);
    onContentChange(newContent);
  };

  const getMonospaceFont = () => {
    return 'font-mono text-sm';
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : isMedia ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <ImageOff className="h-16 w-16 text-muted-foreground" />
          </div>
        ) : (
          <Textarea
            value={editedContent}
            onChange={handleChange}
            className={cn(
              'w-full h-full resize-none border-0 rounded-none',
              'focus:outline-none focus:ring-0',
              'touch-action-manipulation overscroll-contain',
              getMonospaceFont()
            )}
            placeholder={`// Edit ${filePath}...`}
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
}