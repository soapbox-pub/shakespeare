import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GitBranch, Check, Plus, Loader2 } from 'lucide-react';
import { useGitStatus } from '@/hooks/useGitStatus';
import { useGit } from '@/hooks/useGit';
import { useFSPaths } from '@/hooks/useFSPaths';
import { useToast } from '@/hooks/useToast';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface BranchSwitcherProps {
  projectId: string;
  className?: string;
}

export function BranchSwitcher({ projectId, className }: BranchSwitcherProps) {
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [isSwitching, setIsSwitching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const { data: gitStatus } = useGitStatus(projectId);
  const { git } = useGit();
  const { projectsPath } = useFSPaths();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSwitchBranch = async (branchName: string) => {
    if (!gitStatus?.currentBranch || branchName === gitStatus.currentBranch) {
      return;
    }

    // Check for uncommitted changes
    if (gitStatus.hasUncommittedChanges) {
      toast({
        title: "Uncommitted changes",
        description: "Please commit or discard your changes before switching branches.",
        variant: "destructive",
      });
      return;
    }

    setIsSwitching(true);

    try {
      const projectPath = `${projectsPath}/${projectId}`;

      await git.checkout({
        dir: projectPath,
        ref: branchName,
      });

      toast({
        title: "Branch switched",
        description: `Switched to branch "${branchName}"`,
      });

      // Invalidate git status to refresh the UI
      await queryClient.invalidateQueries({ queryKey: ['git-status', projectId] });
    } catch (error) {
      console.error('Failed to switch branch:', error);
      toast({
        title: "Failed to switch branch",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSwitching(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) {
      toast({
        title: "Invalid branch name",
        description: "Branch name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    // Validate branch name (basic validation)
    if (!/^[a-zA-Z0-9_\-/.]+$/.test(newBranchName)) {
      toast({
        title: "Invalid branch name",
        description: "Branch name can only contain letters, numbers, hyphens, underscores, slashes, and dots",
        variant: "destructive",
      });
      return;
    }

    // Check if branch already exists
    if (gitStatus?.branches.includes(newBranchName)) {
      toast({
        title: "Branch already exists",
        description: `A branch named "${newBranchName}" already exists`,
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      const projectPath = `${projectsPath}/${projectId}`;

      // Create new branch
      await git.branch({
        dir: projectPath,
        ref: newBranchName,
      });

      // Switch to the new branch
      await git.checkout({
        dir: projectPath,
        ref: newBranchName,
      });

      toast({
        title: "Branch created",
        description: `Created and switched to branch "${newBranchName}"`,
      });

      // Close dialog and reset state
      setIsCreatingBranch(false);
      setNewBranchName('');

      // Invalidate git status to refresh the UI
      await queryClient.invalidateQueries({ queryKey: ['git-status', projectId] });
    } catch (error) {
      console.error('Failed to create branch:', error);
      toast({
        title: "Failed to create branch",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Don't show if not a git repo
  if (!gitStatus?.isGitRepo) {
    return null;
  }

  const currentBranch = gitStatus.currentBranch || 'main';
  const branches = gitStatus.branches || [];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 text-xs gap-1.5", className)}
            disabled={isSwitching}
          >
            {isSwitching ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <GitBranch className="h-3 w-3" />
            )}
            <span className="max-w-[120px] truncate">{currentBranch}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Switch Branch</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {branches.length > 0 ? (
            branches.map((branch) => (
              <DropdownMenuItem
                key={branch}
                onClick={() => handleSwitchBranch(branch)}
                disabled={branch === currentBranch || isSwitching}
                className="cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="truncate">{branch}</span>
                  {branch === currentBranch && (
                    <Check className="h-4 w-4 ml-2 shrink-0 text-primary" />
                  )}
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>No branches found</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setIsCreatingBranch(true)}
            disabled={isSwitching}
            className="cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create new branch
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isCreatingBranch} onOpenChange={setIsCreatingBranch}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Branch</DialogTitle>
            <DialogDescription>
              Create a new branch from the current branch "{currentBranch}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="branch-name">Branch name</Label>
              <Input
                id="branch-name"
                placeholder="feature/my-new-feature"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateBranch();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreatingBranch(false);
                setNewBranchName('');
              }}
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
                  <GitBranch className="h-4 w-4 mr-2" />
                  Create Branch
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
