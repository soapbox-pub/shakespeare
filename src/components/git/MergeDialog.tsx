import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  GitMerge,
  Loader2,
  AlertCircle,
  CheckCircle,
  GitCommit,
  AlertTriangle,
} from 'lucide-react';
import { useGit } from '@/hooks/useGit';
import { useToast } from '@/hooks/useToast';
import { useSearchParams } from 'react-router-dom';

interface MergeDialogProps {
  projectId: string;
  currentBranch: string | null;
  sourceBranch?: string;
  targetBranch?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onMergeComplete?: () => void;
}

interface MergePreview {
  sourceBranch: string;
  targetBranch: string;
  commitsToMerge: Array<{
    oid: string;
    message: string;
    author: string;
    timestamp: number;
  }>;
  filesChanged: string[];
  canFastForward: boolean;
  hasConflicts: boolean;
  conflictingFiles: string[];
}

export function MergeDialog({
  projectId,
  currentBranch,
  sourceBranch: initialSourceBranch,
  targetBranch: _initialTargetBranch,
  open,
  onOpenChange,
  onMergeComplete,
}: MergeDialogProps) {
  const [isOpen, setIsOpen] = useState(open ?? false);
  const [branches, setBranches] = useState<string[]>([]);
  const [sourceBranch, setSourceBranch] = useState<string>(initialSourceBranch || '');
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mergeComplete, setMergeComplete] = useState(false);

  const { git } = useGit();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectPath = `/projects/${projectId}`;

  useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);

  const loadBranches = useCallback(async () => {
    setIsLoadingBranches(true);
    try {
      const localBranches = await git.listBranches({ dir: projectPath });
      // Filter out current branch from source options
      const availableBranches = localBranches.filter(b => b !== currentBranch);
      setBranches(availableBranches);

      // Set default source branch
      if (availableBranches.length > 0) {
        setSourceBranch(availableBranches[0]);
      }
    } catch (err) {
      console.error('Failed to load branches:', err);
      toast({
        title: 'Failed to load branches',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingBranches(false);
    }
  }, [git, projectPath, currentBranch, toast]);

  const loadMergePreview = useCallback(async () => {
    if (!sourceBranch || !currentBranch) return;

    setIsLoadingPreview(true);
    setError(null);

    try {
      // Get commits that will be merged
      const sourceCommits = await git.log({ dir: projectPath, ref: sourceBranch, depth: 50 });
      const targetCommits = await git.log({ dir: projectPath, ref: currentBranch, depth: 50 });

      const targetCommitIds = new Set(targetCommits.map(c => c.oid));
      const commitsToMerge = sourceCommits.filter(c => !targetCommitIds.has(c.oid));

      // Get changed files
      const sourceFiles = await git.listFiles({ dir: projectPath, ref: sourceBranch });
      const targetFiles = await git.listFiles({ dir: projectPath, ref: currentBranch });

      const changedFiles = new Set<string>();
      for (const file of [...sourceFiles, ...targetFiles]) {
        try {
          const sourceBlob = await git.readBlob({
            dir: projectPath,
            oid: sourceBranch,
            filepath: file,
          }).catch(() => null);

          const targetBlob = await git.readBlob({
            dir: projectPath,
            oid: currentBranch,
            filepath: file,
          }).catch(() => null);

          if (!sourceBlob || !targetBlob ||
              Buffer.from(sourceBlob.blob).toString() !== Buffer.from(targetBlob.blob).toString()) {
            changedFiles.add(file);
          }
        } catch {
          changedFiles.add(file);
        }
      }

      // Check if can fast-forward
      const sourceOid = await git.resolveRef({ dir: projectPath, ref: sourceBranch });
      const targetOid = await git.resolveRef({ dir: projectPath, ref: currentBranch });

      const canFastForward = await git.isDescendent({
        dir: projectPath,
        oid: sourceOid,
        ancestor: targetOid,
      }).catch(() => false);

      // Try to detect conflicts (simplified - real detection happens during merge)
      const conflictingFiles: string[] = [];
      // For now, we'll set this during actual merge

      setMergePreview({
        sourceBranch,
        targetBranch: currentBranch,
        commitsToMerge: commitsToMerge.map(c => ({
          oid: c.oid,
          message: c.commit.message,
          author: c.commit.author.name,
          timestamp: c.commit.author.timestamp,
        })),
        filesChanged: Array.from(changedFiles),
        canFastForward,
        hasConflicts: false,
        conflictingFiles,
      });
    } catch (err) {
      console.error('Failed to load merge preview:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoadingPreview(false);
    }
  }, [sourceBranch, currentBranch, git, projectPath]);

  useEffect(() => {
    if (isOpen) {
      loadBranches();
    }
  }, [isOpen, loadBranches]);

  useEffect(() => {
    if (sourceBranch && currentBranch && sourceBranch !== currentBranch) {
      loadMergePreview();
    } else {
      setMergePreview(null);
    }
  }, [sourceBranch, currentBranch, loadMergePreview]);

  const performMerge = async () => {
    if (!sourceBranch || !currentBranch) return;

    setIsMerging(true);
    setError(null);

    try {
      // Check if can fast-forward
      const sourceOid = await git.resolveRef({ dir: projectPath, ref: sourceBranch });
      const targetOid = await git.resolveRef({ dir: projectPath, ref: currentBranch });

      const canFastForward = await git.isDescendent({
        dir: projectPath,
        oid: sourceOid,
        ancestor: targetOid,
      }).catch(() => false);

      if (canFastForward) {
        // Fast-forward merge: update the current branch to point to source branch commit
        await git.writeRef({
          dir: projectPath,
          ref: `refs/heads/${currentBranch}`,
          value: sourceOid,
          force: true,
        });

        // Update working directory to match the new HEAD
        await git.checkout({
          dir: projectPath,
          ref: currentBranch,
          force: true,
        });

        toast({
          title: 'Fast-forward merge successful',
          description: `Successfully fast-forwarded ${currentBranch} to ${sourceBranch}`,
        });
      } else {
        // Three-way merge
        const result = await git.merge({
          dir: projectPath,
          ours: currentBranch,
          theirs: sourceBranch,
          author: {
            name: 'shakespeare.diy',
            email: 'assistant@shakespeare.diy',
          },
          message: `Merge branch '${sourceBranch}' into ${currentBranch}`,
        });

        if (result.alreadyMerged) {
          toast({
            title: 'Already merged',
            description: 'The branches are already merged',
          });
          setMergeComplete(true);
          onMergeComplete?.();
          return;
        }

        // The merge result contains the new tree OID
        // We need to create a commit with this tree
        const mergeCommitOid = await git.commit({
          dir: projectPath,
          message: `Merge branch '${sourceBranch}' into ${currentBranch}`,
          parent: [targetOid, sourceOid], // Two parents for merge commit
          tree: result.tree,
        });

        console.log('Created merge commit:', mergeCommitOid);

        // Update working directory to match the merge
        await git.checkout({
          dir: projectPath,
          ref: currentBranch,
          force: true,
        });

        toast({
          title: 'Merge successful',
          description: `Successfully merged ${sourceBranch} into ${currentBranch}`,
        });
      }

      setMergeComplete(true);

      // Trigger rebuild
      setTimeout(() => {
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.set('build', '');
        setSearchParams(newSearchParams);
      }, 500);

      onMergeComplete?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      if (errorMessage.includes('conflict') || errorMessage.includes('CONFLICT')) {
        setError('Merge conflicts detected. Please resolve conflicts manually using the terminal.');
      } else {
        setError(errorMessage);
      }

      toast({
        title: 'Merge failed',
        description: errorMessage,
        variant: 'destructive',
        duration: Infinity,
      });
    } finally {
      setIsMerging(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'today';
    } else if (diffDays === 1) {
      return 'yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen);
    onOpenChange?.(newOpen);

    if (!newOpen) {
      setSourceBranch('');
      setMergePreview(null);
      setError(null);
      setMergeComplete(false);
    }
  };

  if (!currentBranch) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <GitMerge className="h-4 w-4" />
          Merge Branch
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Merge Branch
          </DialogTitle>
          <DialogDescription>
            Merge changes from another branch into {currentBranch}
          </DialogDescription>
        </DialogHeader>

        {mergeComplete ? (
          // Success state
          <div className="py-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Merge Complete!</h3>
              <p className="text-muted-foreground">
                Successfully merged {sourceBranch} into {currentBranch}
              </p>
            </div>
            <Button onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 pr-4">
              {/* Source branch selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Source Branch</label>
                <Select
                  value={sourceBranch}
                  onValueChange={setSourceBranch}
                  disabled={isLoadingBranches || isMerging}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch to merge from" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch} value={branch}>
                        {branch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The branch to merge into {currentBranch}
                </p>
              </div>

              {/* Merge direction visualization */}
              {sourceBranch && (
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 justify-center text-sm">
                    <Badge variant="outline" className="font-mono">
                      {sourceBranch}
                    </Badge>
                    <GitMerge className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="default" className="font-mono">
                      {currentBranch}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Error alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Loading preview */}
              {isLoadingPreview && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                  <span className="text-muted-foreground">Loading merge preview...</span>
                </div>
              )}

              {/* Merge preview */}
              {mergePreview && !isLoadingPreview && (
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="pt-6 text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {mergePreview.commitsToMerge.length}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Commits to Merge
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6 text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {mergePreview.filesChanged.length}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Files Changed
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Fast-forward badge */}
                  {mergePreview.canFastForward && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        This merge can be fast-forwarded (no merge commit needed)
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Commits to merge */}
                  {mergePreview.commitsToMerge.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3">Commits to be merged:</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {mergePreview.commitsToMerge.slice(0, 10).map((commit) => (
                          <div
                            key={commit.oid}
                            className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                          >
                            <GitCommit className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">
                                {commit.message.split('\n')[0]}
                              </p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <span>{commit.author}</span>
                                <span>•</span>
                                <span>{formatDate(commit.timestamp)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {mergePreview.commitsToMerge.length > 10 && (
                          <p className="text-xs text-muted-foreground text-center py-2">
                            + {mergePreview.commitsToMerge.length - 10} more commits
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* No changes */}
                  {mergePreview.commitsToMerge.length === 0 && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        No new commits to merge. The branches are already in sync.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Warning about conflicts */}
                  {mergePreview.hasConflicts && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Conflicts detected in {mergePreview.conflictingFiles.length} file(s).
                        You may need to resolve conflicts manually.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {!mergeComplete && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isMerging}
            >
              Cancel
            </Button>
            <Button
              onClick={performMerge}
              disabled={
                isMerging ||
                isLoadingPreview ||
                !mergePreview ||
                mergePreview.commitsToMerge.length === 0
              }
            >
              {isMerging ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <GitMerge className="h-4 w-4 mr-2" />
                  Merge Branch
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
