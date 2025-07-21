import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileContents } from '@/components/ai/FileContents';

interface FileViewerProps {
  path: string;
  result?: string;
  isError?: boolean;
  className?: string;
}

export function FileViewer({ path, result, isError = false, className }: FileViewerProps) {
  // Determine if it's a directory or file based on the result
  const isDirectory = result?.includes('├──') || result?.includes('└──') || result?.includes('│');

  // Get file extension for syntax highlighting hints
  const getFileExtension = (filePath: string) => {
    const parts = filePath.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  };

  const getFileIcon = (filePath: string, isDir: boolean) => {
    if (isDir) return '📁';

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

  const fileIcon = getFileIcon(path, isDirectory || false);
  const fileExtension = getFileExtension(path);

  // Parse directory structure for better display
  const parseDirectoryStructure = (content: string) => {
    if (!isDirectory) return content;

    const lines = content.split('\n').filter(line => line.trim());
    return lines.map((line) => {
      // Extract the file/folder name from tree structure
      const match = line.match(/[├└]──\s*(.+)$/);
      if (match) {
        const name = match[1];
        const isFolder = !name.includes('.');
        const icon = isFolder ? '📁' : getFileIcon(name, false);
        return { line, name, icon, isFolder };
      }
      return { line, name: line.trim(), icon: '📄', isFolder: false };
    });
  };

  const directoryItems = isDirectory ? parseDirectoryStructure(result || '') : [];
  const directoryItemsArray = Array.isArray(directoryItems) ? directoryItems : [];

  return (
    <Card className={cn("mt-2", isError ? "border-destructive/50" : "border-muted", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-lg">{fileIcon}</span>
            </div>
            <div>
              <div className="font-mono text-sm font-medium">{path}</div>
              <div className="text-xs text-muted-foreground">
                {isDirectory ? 'Directory listing' : `${fileExtension ? fileExtension.toUpperCase() + ' file' : 'File'} contents`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {result ? (
              isError ? (
                <Badge variant="destructive" className="text-xs">
                  <XCircle className="h-3 w-3 mr-1" />
                  Error
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Viewed
                </Badge>
              )
            ) : (
              <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">
                <Eye className="h-3 w-3 mr-1" />
                Loading
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      {result && (
        <CardContent className="pt-0">
          {isError ? (
            <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-3 text-sm">
              {result}
            </div>
          ) : isDirectory ? (
            <div className="bg-muted/30 rounded-md overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 text-xs font-mono text-muted-foreground border-b border-muted/50">
                Directory Structure
              </div>
              <div className="p-3 max-h-80 overflow-y-auto">
                <div className="space-y-1">
                  {directoryItemsArray.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm font-mono">
                      <span className="text-muted-foreground">{item.line.replace(/[├└]──\s*(.+)$/, '')}</span>
                      <span className="text-xs">{item.icon}</span>
                      <span className={cn(
                        item.isFolder ? "text-blue-600 dark:text-blue-400 font-medium" : "text-foreground"
                      )}>
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <FileContents
              content={result}
              filePath={path}
              headerContent={fileExtension && (
                <span className="text-xs bg-muted px-2 py-1 rounded">
                  {fileExtension.toUpperCase()}
                </span>
              )}
            />
          )}

          {/* File stats */}
          {!isError && result && (
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              {isDirectory ? (
                <span>
                  {directoryItemsArray.length} item{directoryItemsArray.length !== 1 ? 's' : ''}
                </span>
              ) : (
                <>
                  <span>
                    {result.split('\n').length} line{result.split('\n').length !== 1 ? 's' : ''}
                  </span>
                  <span>
                    {result.length} character{result.length !== 1 ? 's' : ''}
                  </span>
                </>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}