import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileEditorProps {
  filePath: string;
  content: string;
  onSave: (content: string) => void;
  isLoading: boolean;
}

export function FileEditor({ filePath, content, onSave, isLoading }: FileEditorProps) {
  const [editedContent, setEditedContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setEditedContent(content);
    setHasChanges(false);
  }, [content, filePath]);

  useEffect(() => {
    setHasChanges(editedContent !== content);
  }, [editedContent, content]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedContent);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save file:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getLanguageFromPath = (path: string): string => {
    const extension = path.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      html: 'html',
      css: 'css',
      json: 'json',
      md: 'markdown',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      sh: 'bash',
      yml: 'yaml',
      yaml: 'yaml',
    };
    return languageMap[extension || ''] || 'text';
  };

  const getMonospaceFont = () => {
    return 'font-mono text-sm';
  };

  return (
    <div className="h-full flex flex-col">
      <CardHeader className="border-b py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{filePath}</CardTitle>
          <div className="flex items-center space-x-2">
            {hasChanges && (
              <span className="text-sm text-muted-foreground">Unsaved changes</span>
            )}
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving || isLoading}
              size="sm"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Language: {getLanguageFromPath(filePath)}
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : (
          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className={cn(
              'w-full h-full resize-none border-0 rounded-none',
              'focus:outline-none focus:ring-0',
              getMonospaceFont()
            )}
            placeholder={`// Edit ${filePath}...`}
            spellCheck={false}
          />
        )}
      </CardContent>
    </div>
  );
}