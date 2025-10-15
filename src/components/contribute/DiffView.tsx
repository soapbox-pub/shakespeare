import { useEffect, useState } from 'react';
import { useGit } from '@/hooks/useGit';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FileIcon, FilePlusIcon, FileMinusIcon, FileEditIcon } from 'lucide-react';

interface DiffViewProps {
  projectDir: string;
}

interface FileChange {
  filepath: string;
  type: 'added' | 'modified' | 'deleted' | 'untracked';
}

export function DiffView({ projectDir }: DiffViewProps) {
  const { git } = useGit();
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadChanges = async () => {
      try {
        const statusMatrix = await git.statusMatrix({ dir: projectDir });
        
        const fileChanges: FileChange[] = statusMatrix
          .filter(([, head, workdir, stage]) => {
            // Show files that are different between HEAD and workdir
            return head !== workdir || stage !== head;
          })
          .map(([filepath, head, workdir, stage]) => {
            let type: FileChange['type'] = 'modified';
            
            if (head === 0 && workdir !== 0) {
              type = stage === 0 ? 'untracked' : 'added';
            } else if (head !== 0 && workdir === 0) {
              type = 'deleted';
            } else if (head !== workdir) {
              type = 'modified';
            }
            
            return { filepath, type };
          });

        setChanges(fileChanges);
      } catch (error) {
        console.error('Failed to load changes:', error);
        setChanges([]);
      } finally {
        setLoading(false);
      }
    };

    loadChanges();
  }, [git, projectDir]);

  const getFileIcon = (type: FileChange['type']) => {
    switch (type) {
      case 'added':
      case 'untracked':
        return <FilePlusIcon className="h-4 w-4 text-green-600" />;
      case 'deleted':
        return <FileMinusIcon className="h-4 w-4 text-red-600" />;
      case 'modified':
        return <FileEditIcon className="h-4 w-4 text-blue-600" />;
      default:
        return <FileIcon className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: FileChange['type']) => {
    const variants = {
      added: 'default',
      untracked: 'secondary',
      modified: 'secondary',
      deleted: 'destructive',
    } as const;

    return (
      <Badge variant={variants[type]} className="text-xs">
        {type}
      </Badge>
    );
  };

  const stats = {
    added: changes.filter(c => c.type === 'added' || c.type === 'untracked').length,
    modified: changes.filter(c => c.type === 'modified').length,
    deleted: changes.filter(c => c.type === 'deleted').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        Loading changes...
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        No changes to review
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">Changes:</span>
        {stats.added > 0 && (
          <span className="text-green-600">+{stats.added} added</span>
        )}
        {stats.modified > 0 && (
          <span className="text-blue-600">~{stats.modified} modified</span>
        )}
        {stats.deleted > 0 && (
          <span className="text-red-600">-{stats.deleted} deleted</span>
        )}
      </div>

      <ScrollArea className="h-64 border rounded-lg">
        <div className="p-2 space-y-1">
          {changes.map((change) => (
            <div
              key={change.filepath}
              className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {getFileIcon(change.type)}
                <span className="text-sm font-mono truncate">{change.filepath}</span>
              </div>
              {getTypeBadge(change.type)}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
