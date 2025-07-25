import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { History, GitCommit, User, Calendar, Hash } from 'lucide-react';
import { useFS } from '@/hooks/useFS';
import git from 'isomorphic-git';

interface GitCommit {
  oid: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      timestamp: number;
    };
    committer: {
      name: string;
      email: string;
      timestamp: number;
    };
  };
}

interface GitHistoryDialogProps {
  projectId: string;
}

export function GitHistoryDialog({ projectId }: GitHistoryDialogProps) {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { fs } = useFS();

  const loadGitHistory = useCallback(async () => {
    if (!fs) return;

    setIsLoading(true);
    setError(null);

    try {
      const projectPath = `/projects/${projectId}`;

      // Check if git repository exists
      try {
        await fs.stat(`${projectPath}/.git`);
      } catch {
        setError('No git repository found in this project');
        return;
      }

      // Get git log
      const gitLog = await git.log({
        fs,
        dir: projectPath,
        depth: 50, // Limit to last 50 commits
      });

      setCommits(gitLog);
    } catch (err) {
      console.error('Failed to load git history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load git history');
    } finally {
      setIsLoading(false);
    }
  }, [fs, projectId]);

  useEffect(() => {
    if (isOpen) {
      loadGitHistory();
    }
  }, [isOpen, loadGitHistory]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const commitTime = timestamp * 1000;
    const diffMs = now - commitTime;

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 60) {
      return `${diffMinutes} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else {
      return `${diffDays} days ago`;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 sm:gap-2 hover:bg-secondary/10 hover:border-secondary/20"
        >
          <History className="h-4 w-4" />
          <span className="hidden sm:inline">History</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCommit className="h-5 w-5" />
            Git History
          </DialogTitle>
          <DialogDescription>
            View the commit history for this project
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Loading git history...
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-2">
                <p className="text-destructive font-medium">Error loading git history</p>
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" onClick={loadGitHistory}>
                  Try Again
                </Button>
              </div>
            </div>
          ) : !commits || commits.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-2">
                <GitCommit className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">No commits found</p>
                <p className="text-sm text-muted-foreground">
                  This project doesn't have any git commits yet
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[60vh]">
              <div className="space-y-4 pr-4">
                {commits.map((commit, index) => (
                  <div key={commit.oid} className="space-y-3">
                    <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                      <div className="flex-shrink-0 mt-1">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-medium text-sm leading-relaxed">
                            {commit.commit.message}
                          </h3>
                          <Badge variant="secondary" className="text-xs font-mono">
                            <Hash className="h-3 w-3 mr-1" />
                            {commit.oid.substring(0, 7)}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{commit.commit.author.name}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span title={formatDate(commit.commit.author.timestamp)}>
                              {formatRelativeTime(commit.commit.author.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {index < commits.length - 1 && (
                      <div className="flex justify-center">
                        <div className="h-4 w-px bg-border" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}