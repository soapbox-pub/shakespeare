import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  GitBranch,
  MoreHorizontal,
  MessageSquarePlus,
  CloudUpload,
  Loader2,
  History,
  Trash2,
} from 'lucide-react';
import { GitHistoryDialog } from '@/components/ai/GitHistoryDialog';
import { GitDialog } from '@/components/GitDialog';
import { useNavigate } from 'react-router-dom';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useToast } from '@/hooks/useToast';

interface ActionsMenuProps {
  projectId: string;
  projectName: string;
  onNewChat: () => void;
  onDeploy: () => void;
  isLoading?: boolean;
  isBuildLoading?: boolean;
  isDeployLoading?: boolean;
  disabled?: boolean;
  onFirstInteraction?: () => void;
  onProjectDeleted?: () => void;
}

export function ActionsMenu({
  projectId,
  projectName,
  onNewChat,
  onDeploy,
  isLoading = false,
  isBuildLoading = false,
  isDeployLoading = false,
  disabled = false,
  onFirstInteraction,
  onProjectDeleted
}: ActionsMenuProps) {
  const [gitHistoryOpen, setGitHistoryOpen] = useState(false);
  const [gitDialogOpen, setGitDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const navigate = useNavigate();
  const projectsManager = useProjectsManager();
  const { toast } = useToast();

  const isAnyLoading = isLoading || isBuildLoading || isDeployLoading || isDeleting;

  const handleDeleteProject = async () => {
    setIsDeleting(true);
    try {
      await projectsManager.deleteProject(projectId);

      toast({
        title: "Project deleted",
        description: `"${projectName}" has been permanently deleted.`,
      });

      // Navigate back to home and notify parent
      navigate('/');
      if (onProjectDeleted) {
        onProjectDeleted();
      }
    } catch (error) {
      toast({
        title: "Failed to delete project",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={disabled}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={onNewChat}
            disabled={isLoading}
            className="gap-2"
          >
            <MessageSquarePlus className="h-4 w-4" />
            New Chat
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setGitDialogOpen(true)}
            disabled={isAnyLoading}
            className="gap-2"
          >
            <GitBranch className="h-4 w-4" />
            Repository
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setGitHistoryOpen(true)}
            disabled={isAnyLoading}
            className="gap-2"
          >
            <History className="h-4 w-4" />
            Rollback
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              if (onFirstInteraction) onFirstInteraction();
              onDeploy();
            }}
            disabled={isAnyLoading}
            className="gap-2"
          >
            {isDeployLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CloudUpload className="h-4 w-4" />
            )}
            {isDeployLoading ? 'Deploying...' : 'Deploy'}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer gap-2"
                onSelect={(e) => e.preventDefault()}
              >
                <Trash2 className="h-4 w-4" />
                Delete Project
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{projectName}"? This action cannot be undone and will permanently delete all project data including files.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteProject}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Project'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs */}
      <GitDialog
        projectId={projectId}
        open={gitDialogOpen}
        onOpenChange={setGitDialogOpen}
      />

      <GitHistoryDialog
        projectId={projectId}
        open={gitHistoryOpen}
        onOpenChange={setGitHistoryOpen}
      />
    </>
  );
}