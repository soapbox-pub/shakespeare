import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGitStatus } from '@/hooks/useGitStatus';

interface FileEditorProps {
  filePath: string;
  content: string;
  onSave: (content: string) => void;
  isLoading: boolean;
  projectId?: string;
}

export function FileEditor({ filePath, content, onSave, isLoading, projectId }: FileEditorProps) {
  const { t } = useTranslation();
  const [editedContent, setEditedContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { data: gitStatus } = useGitStatus(projectId || null);

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

  // Helper function to get git status for the current file
  const getFileGitStatus = (filePath: string) => {
    if (!gitStatus?.changedFiles) return null;
    const fileChange = gitStatus.changedFiles.find(change => change.filepath === filePath);
    return fileChange?.status || null;
  };

  // Helper function to get styling classes based on git status
  const getGitStatusClasses = (status: string | null) => {
    switch (status) {
      case 'added':
      case 'untracked':
        return 'text-green-600 dark:text-green-400';
      case 'modified':
      case 'staged':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return '';
    }
  };

  // Get git status for the current file
  const currentFileGitStatus = getFileGitStatus(filePath);
  const gitStatusClasses = getGitStatusClasses(currentFileGitStatus);

  return (
    <div className="h-full flex flex-col">
      <CardHeader className="border-b py-2 sm:py-3">
        <div className="flex items-center justify-between">
          <CardTitle className={cn("text-sm sm:text-base truncate flex-1 mr-2", gitStatusClasses)}>{filePath}</CardTitle>
          <div className="flex items-center space-x-1 sm:space-x-2">
            {hasChanges && (
              <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">{t('unsavedChanges')}</span>
            )}
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving || isLoading}
              size="sm"
              className="focus-ring"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-1 sm:mr-2 h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">{t('saving')}</span>
                </>
              ) : (
                <>
                  <Save className="sm:mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">{t('save')}</span>
                </>
              )}
            </Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {t('languageLabel')}: {getLanguageFromPath(filePath)}
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
              'touch-action-manipulation overscroll-contain',
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