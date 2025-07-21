import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileContents } from '@/components/ai/FileContents';

interface FileWriterProps {
  path: string;
  fileText: string;
  result?: string;
  isError?: boolean;
  className?: string;
}

export function FileWriter({ path, fileText, result, isError = false, className }: FileWriterProps) {
  // Get file extension for syntax highlighting hints
  const getFileExtension = (filePath: string) => {
    const parts = filePath.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  };

  const getFileIcon = (filePath: string) => {
    const ext = getFileExtension(filePath);
    switch (ext) {
      case 'ts':
      case 'tsx': return '🔷';
      case 'js':
      case 'jsx': return '🟨';
      case 'json': return '📋';
      case 'md': return '📝';
      case 'css': return '🎨';
      case 'html': return '🌐';
      case 'svg': return '🖼️';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif': return '🖼️';
      case 'yml':
      case 'yaml': return '⚙️';
      case 'toml': return '⚙️';
      case 'lock': return '🔒';
      default: return '📄';
    }
  };

  const fileIcon = getFileIcon(path);
  const fileExtension = getFileExtension(path);
  const isNewFile = path.includes('new') || result?.includes('created') || result?.includes('Created');

  // Calculate file stats
  const lineCount = fileText.split('\n').length;
  const charCount = fileText.length;
  const wordCount = fileText.split(/\s+/).filter(word => word.length > 0).length;

  // Preview first few lines for collapsed view
  const previewLines = fileText.split('\n').slice(0, 5);
  const hasMoreLines = lineCount > 5;
  const previewContent = previewLines.join('\n') + (hasMoreLines ? `\n... (${lineCount - 5} more lines)` : '');

  return (
    <Card className={cn("mt-2", isError ? "border-destructive/50" : "border-muted", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-lg">{fileIcon}</span>
            </div>
            <div>
              <div className="font-mono text-sm font-medium">{path}</div>
              <div className="text-xs text-muted-foreground">
                {isNewFile ? 'Created new file' : 'Updated file contents'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {result !== undefined ? (
              isError ? (
                <Badge variant="destructive" className="text-xs">
                  <XCircle className="h-3 w-3 mr-1" />
                  Failed
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {isNewFile ? 'Created' : 'Updated'}
                </Badge>
              )
            ) : (
              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                <Edit3 className="h-3 w-3 mr-1" />
                Writing
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Error display */}
        {isError && result && (
          <div className="mb-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-3 text-sm">
            {result}
          </div>
        )}

        {/* File stats */}
        <div className="mb-3 flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">
            {lineCount} line{lineCount !== 1 ? 's' : ''}
          </span>
          <span className="text-muted-foreground">
            {wordCount} word{wordCount !== 1 ? 's' : ''}
          </span>
          <span className="text-muted-foreground">
            {charCount} character{charCount !== 1 ? 's' : ''}
          </span>
          {fileExtension && (
            <Badge variant="outline" className="text-xs">
              {fileExtension.toUpperCase()}
            </Badge>
          )}
        </div>

        {/* File preview */}
        <details className="group">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform">▶</span>
            Preview file contents
          </summary>
          <FileContents
            content={hasMoreLines ? previewContent : fileText}
            filePath={path}
            showLineNumbers={false}
            headerContent={fileExtension && (
              <span className="text-xs bg-muted px-2 py-1 rounded">
                {fileExtension.toUpperCase()}
              </span>
            )}
          />
        </details>

        {/* Success message */}
        {!isError && result && (
          <div className="mt-3 text-xs text-green-600 dark:text-green-400">
            ✓ File {isNewFile ? 'created' : 'updated'} successfully
          </div>
        )}
      </CardContent>
    </Card>
  );
}