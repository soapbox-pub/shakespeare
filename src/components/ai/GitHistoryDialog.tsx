import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { History, GitCommit, RotateCcw, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useFS } from '@/hooks/useFS';
import { useToast } from '@/hooks/useToast';
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
  const [isRollingBack, setIsRollingBack] = useState<string | null>(null);
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set());
  const { fs } = useFS();
  const { toast } = useToast();

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

  const rollbackToCommit = useCallback(async (targetCommit: GitCommit) => {
    if (!fs) return;

    setIsRollingBack(targetCommit.oid);

    try {
      const projectPath = `/projects/${projectId}`;

      // Get the current HEAD commit
      const currentCommit = await git.resolveRef({
        fs,
        dir: projectPath,
        ref: 'HEAD',
      });

      // If we're already at this commit, no need to rollback
      if (currentCommit === targetCommit.oid) {
        toast({
          title: "Already at this commit",
          description: "The codebase is already at this commit.",
        });
        return;
      }

      // Get all commits between the target commit and HEAD
      const allCommits = await git.log({
        fs,
        dir: projectPath,
        depth: 1000,
      });

      // Find the index of target commit and current HEAD
      const targetIndex = allCommits.findIndex(c => c.oid === targetCommit.oid);
      const currentIndex = allCommits.findIndex(c => c.oid === currentCommit);

      if (targetIndex === -1) {
        throw new Error('Target commit not found in history');
      }

      if (currentIndex === -1) {
        throw new Error('Current commit not found in history');
      }

      // Get commits to revert (from current back to target, exclusive)
      const commitsToRevert = allCommits.slice(currentIndex, targetIndex);

      if (commitsToRevert.length === 0) {
        toast({
          title: "No commits to revert",
          description: "The target commit is ahead of the current commit.",
        });
        return;
      }

      // Simple approach: checkout the target commit's tree and create a new commit
      // This effectively "reverts" to that state without complex merge logic

      // Get all files from the target commit
      const targetFiles = await git.listFiles({
        fs,
        dir: projectPath,
        ref: targetCommit.oid,
      });

      // Get current files to know what to remove
      const currentFiles = await git.listFiles({
        fs,
        dir: projectPath,
        ref: 'HEAD',
      });

      // Remove files that don't exist in target commit
      for (const filepath of currentFiles) {
        if (!targetFiles.includes(filepath)) {
          try {
            await fs.unlink(`${projectPath}/${filepath}`);
            await git.remove({
              fs,
              dir: projectPath,
              filepath,
            });
          } catch (err) {
            // File might not exist, continue
            console.warn(`Could not remove ${filepath}:`, err);
          }
        }
      }

      // Restore all files from target commit
      for (const filepath of targetFiles) {
        try {
          const { blob } = await git.readBlob({
            fs,
            dir: projectPath,
            oid: targetCommit.oid,
            filepath,
          });

          // Ensure directory exists
          const dirPath = filepath.split('/').slice(0, -1).join('/');
          if (dirPath) {
            await fs.mkdir(`${projectPath}/${dirPath}`, { recursive: true });
          }

          // Write the file
          await fs.writeFile(`${projectPath}/${filepath}`, blob);

          // Stage the file
          await git.add({
            fs,
            dir: projectPath,
            filepath,
          });
        } catch (err) {
          console.error(`Failed to restore ${filepath}:`, err);
        }
      }

      // Create a revert commit
      const revertMessage = `Revert to ${targetCommit.oid.substring(0, 7)}: ${targetCommit.commit.message}

This reverts the codebase back to the state at commit ${targetCommit.oid.substring(0, 7)}.

Reverted ${commitsToRevert.length} commit(s):
${commitsToRevert.map(c => `- ${c.oid.substring(0, 7)}: ${c.commit.message}`).join('\n')}`;

      await git.commit({
        fs,
        dir: projectPath,
        message: revertMessage,
        author: {
          name: 'Shakespeare AI',
          email: 'ai@shakespeare.dev',
        },
      });

      toast({
        title: "Rollback successful",
        description: `Reverted ${commitsToRevert.length} commit(s) back to ${targetCommit.oid.substring(0, 7)}`,
      });

      // Reload the git history to show the new commit
      await loadGitHistory();

    } catch (err) {
      console.error('Failed to rollback:', err);
      toast({
        title: "Rollback failed",
        description: err instanceof Error ? err.message : 'Failed to rollback to this commit',
        variant: "destructive",
      });
    } finally {
      setIsRollingBack(null);
    }
  }, [fs, projectId, toast, loadGitHistory]);

  useEffect(() => {
    if (isOpen) {
      loadGitHistory();
    }
  }, [isOpen, loadGitHistory]);

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

  const getCommitMessageLines = (message: string) => {
    const lines = message.split('\n').filter(line => line.trim() !== '');
    return {
      firstLine: lines[0] || '',
      hasMoreLines: lines.length > 1,
      fullMessage: message,
    };
  };

  const toggleCommitExpansion = (commitOid: string) => {
    setExpandedCommits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commitOid)) {
        newSet.delete(commitOid);
      } else {
        newSet.add(commitOid);
      }
      return newSet;
    });
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
              <div className="space-y-1 pr-4">
                {commits.map((commit, index) => {
                  const { firstLine, hasMoreLines, fullMessage } = getCommitMessageLines(commit.commit.message);
                  const isExpanded = expandedCommits.has(commit.oid);

                  return (
                    <div key={commit.oid} className="group hover:bg-muted/50 rounded-md p-3 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-sm text-foreground break-words">
                              {firstLine}
                            </h3>
                            {hasMoreLines && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 shrink-0 opacity-60 hover:opacity-100"
                                onClick={() => toggleCommitExpansion(commit.oid)}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                          </div>

                          {isExpanded && hasMoreLines && (
                            <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words mt-2 pl-2 border-l-2 border-muted">
                              {fullMessage.split('\n').slice(1).join('\n').trim()}
                            </div>
                          )}

                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="font-medium">{commit.commit.author.name}</span>
                            <span>committed {formatRelativeTime(commit.commit.author.timestamp)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {index > 0 && ( // Don't show rollback for the most recent commit
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs gap-1 hover:bg-destructive/10 hover:border-destructive/20 hover:text-destructive"
                                  disabled={isRollingBack !== null}
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  Rollback
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-destructive" />
                                    Confirm Rollback
                                  </AlertDialogTitle>
                                  <AlertDialogDescription className="space-y-2">
                                    <p>
                                      This will create a new commit that reverts the codebase back to:
                                    </p>
                                    <div className="bg-muted p-3 rounded-md text-sm">
                                      <div className="font-medium break-words">{firstLine}</div>
                                      <div className="text-muted-foreground text-xs mt-1">
                                        {commit.oid.substring(0, 7)} • {formatRelativeTime(commit.commit.author.timestamp)}
                                      </div>
                                    </div>
                                    <p className="text-sm">
                                      This action will revert <strong>{index} commit(s)</strong> and cannot be undone easily.
                                      A new commit will be created with the reverted changes.
                                    </p>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => rollbackToCommit(commit)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    disabled={isRollingBack !== null}
                                  >
                                    {isRollingBack === commit.oid ? (
                                      <>
                                        <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent mr-1" />
                                        Rolling back...
                                      </>
                                    ) : (
                                      <>
                                        <RotateCcw className="h-3 w-3 mr-1" />
                                        Rollback
                                      </>
                                    )}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}

                          <Badge variant="secondary" className="text-xs font-mono">
                            {commit.oid.substring(0, 7)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}