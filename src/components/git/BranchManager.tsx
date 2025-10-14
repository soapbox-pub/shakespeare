import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  GitBranch,
  Plus,
  Trash2,
  GitMerge,
  GitCompare,
  Check,
  Loader2,
  ArrowUpRight,
} from 'lucide-react';
import { useGit } from '@/hooks/useGit';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

interface BranchInfo {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  remoteName?: string;
  commitId?: string;
  ahead?: number;
  behind?: number;
}

interface BranchManagerProps {
  projectId: string;
  currentBranch: string | null;
  onBranchChange?: () => void;
}

export function BranchManager({ projectId, currentBranch, onBranchChange }: BranchManagerProps) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newBranchName, setNewBranchName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deletingBranch, setDeletingBranch] = useState<string | null>(null);
  const [switchingToBranch, setSwitchingToBranch] = useState<string | null>(null);

  const { git } = useGit();
  const { toast } = useToast();
  const projectPath = `/projects/${projectId}`;

  useEffect(() => {
    loadBranches();
  }, [projectId, currentBranch]);

  const loadBranches = async () => {
    setIsLoading(true);
    try {
      // Get local branches
      const localBranches = await git.listBranches({
        dir: projectPath,
      });

      // Get remote branches
      let remoteBranches: string[] = [];
      try {
        remoteBranches = await git.listBranches({
          dir: projectPath,
          remote: 'origin',
        });
      } catch {
        // No remote or error fetching remote branches
      }

      // Get current branch
      const current = await git.currentBranch({ dir: projectPath }).catch(() => null);

      // Build branch info
      const branchInfos: BranchInfo[] = [];

      // Add local branches
      for (const branch of localBranches) {
        const isCurrent = branch === current;
        let commitId: string | undefined;
        try {
          commitId = await git.resolveRef({
            dir: projectPath,
            ref: `refs/heads/${branch}`,
          });
        } catch {
          // Skip branches we can't resolve
        }

        branchInfos.push({
          name: branch,
          isCurrent,
          isRemote: false,
          commitId,
        });
      }

      // Add remote branches
      for (const branch of remoteBranches) {
        // Skip if we already have this as a local branch
        if (localBranches.includes(branch)) continue;

        let commitId: string | undefined;
        try {
          commitId = await git.resolveRef({
            dir: projectPath,
            ref: `refs/remotes/origin/${branch}`,
          });
        } catch {
          // Skip branches we can't resolve
        }

        branchInfos.push({
          name: branch,
          isCurrent: false,
          isRemote: true,
          remoteName: 'origin',
          commitId,
        });
      }

      setBranches(branchInfos);
    } catch (error) {
      console.error('Failed to load branches:', error);
      toast({
        title: 'Failed to load branches',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) {
      toast({
        title: 'Invalid branch name',
        description: 'Please enter a branch name',
        variant: 'destructive',
      });
      return;
    }

    // Validate branch name
    const invalidChars = /[~^: \\?*[\]]/;
    if (invalidChars.test(newBranchName)) {
      toast({
        title: 'Invalid branch name',
        description: 'Branch name contains invalid characters',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      // Get current HEAD to base the new branch on
      const currentRef = await git.resolveRef({
        dir: projectPath,
        ref: 'HEAD',
      });

      // Create the new branch
      await git.branch({
        dir: projectPath,
        ref: newBranchName.trim(),
        object: currentRef,
      });

      toast({
        title: 'Branch created',
        description: `Created branch "${newBranchName}"`,
      });

      setNewBranchName('');
      setIsCreateDialogOpen(false);
      await loadBranches();
      onBranchChange?.();
    } catch (error) {
      toast({
        title: 'Failed to create branch',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSwitchBranch = async (branchName: string) => {
    setSwitchingToBranch(branchName);
    try {
      await git.checkout({
        dir: projectPath,
        ref: branchName,
      });

      toast({
        title: 'Branch switched',
        description: `Switched to branch "${branchName}"`,
      });

      await loadBranches();
      onBranchChange?.();
    } catch (error) {
      toast({
        title: 'Failed to switch branch',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSwitchingToBranch(null);
    }
  };

  const handleDeleteBranch = async (branchName: string) => {
    setDeletingBranch(branchName);
    try {
      await git.deleteBranch({
        dir: projectPath,
        ref: branchName,
      });

      toast({
        title: 'Branch deleted',
        description: `Deleted branch "${branchName}"`,
      });

      await loadBranches();
      onBranchChange?.();
    } catch (error) {
      toast({
        title: 'Failed to delete branch',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setDeletingBranch(null);
    }
  };

  const localBranches = branches.filter(b => !b.isRemote);
  const remoteBranches = branches.filter(b => b.isRemote);

  return (
    <div className="space-y-4">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Branches</h3>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-2">
              <Plus className="h-4 w-4" />
              New Branch
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Branch</DialogTitle>
              <DialogDescription>
                Create a new branch from the current HEAD
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="branch-name">Branch Name</Label>
                <Input
                  id="branch-name"
                  placeholder="feature/my-new-feature"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isCreating) {
                      handleCreateBranch();
                    }
                  }}
                  autoFocus
                />
              </div>
              {currentBranch && (
                <div className="text-sm text-muted-foreground">
                  Creating from: <span className="font-medium">{currentBranch}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateBranch} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Branch
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-4">
            {/* Local Branches */}
            {localBranches.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Local Branches
                </div>
                <div className="space-y-1">
                  {localBranches.map((branch) => (
                    <BranchItem
                      key={branch.name}
                      branch={branch}
                      onSwitch={handleSwitchBranch}
                      onDelete={handleDeleteBranch}
                      isSwitching={switchingToBranch === branch.name}
                      isDeleting={deletingBranch === branch.name}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Remote Branches */}
            {remoteBranches.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Remote Branches
                </div>
                <div className="space-y-1">
                  {remoteBranches.map((branch) => (
                    <BranchItem
                      key={`remote-${branch.name}`}
                      branch={branch}
                      onSwitch={handleSwitchBranch}
                      onDelete={handleDeleteBranch}
                      isSwitching={switchingToBranch === branch.name}
                      isDeleting={deletingBranch === branch.name}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {localBranches.length === 0 && remoteBranches.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <GitBranch className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No branches found</p>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

interface BranchItemProps {
  branch: BranchInfo;
  onSwitch: (name: string) => void;
  onDelete: (name: string) => void;
  isSwitching: boolean;
  isDeleting: boolean;
}

function BranchItem({ branch, onSwitch, onDelete, isSwitching, isDeleting }: BranchItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg border transition-colors group',
          branch.isCurrent
            ? 'bg-primary/5 border-primary/20'
            : 'hover:bg-muted/50 border-transparent'
        )}
      >
        {/* Branch icon and name */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {branch.isCurrent ? (
            <Check className="h-4 w-4 text-primary shrink-0" />
          ) : (
            <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'font-mono text-sm truncate',
                  branch.isCurrent && 'font-semibold text-primary'
                )}
              >
                {branch.name}
              </span>
              {branch.isRemote && (
                <ArrowUpRight className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
            </div>
            {branch.commitId && (
              <div className="text-xs text-muted-foreground font-mono">
                {branch.commitId.substring(0, 7)}
              </div>
            )}
          </div>
        </div>

        {/* Current badge */}
        {branch.isCurrent && (
          <Badge variant="secondary" className="shrink-0">
            Current
          </Badge>
        )}

        {/* Actions */}
        {!branch.isCurrent && !branch.isRemote && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => onSwitch(branch.name)}
              disabled={isSwitching || isDeleting}
            >
              {isSwitching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <GitBranch className="h-4 w-4 mr-1" />
                  Switch
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isSwitching || isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Branch</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the branch <strong>{branch.name}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete(branch.name);
                setShowDeleteDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Branch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
