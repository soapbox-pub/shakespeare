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
  MoreHorizontal,
  MessageSquarePlus,
  Play,
  CloudUpload,
  Loader2,
  GitBranch,
  Download,
  Trash2,
} from 'lucide-react';
import { GitHistoryDialog } from '@/components/ai/GitHistoryDialog';
import { useNavigate } from 'react-router-dom';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useToast } from '@/hooks/useToast';
import { useFS } from '@/hooks/useFS';
import JSZip from 'jszip';
import git from 'isomorphic-git';

interface ActionsMenuProps {
  projectId: string;
  projectName: string;
  onNewChat: () => void;
  onBuild: () => void;
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
  onBuild,
  onDeploy,
  isLoading = false,
  isBuildLoading = false,
  isDeployLoading = false,
  disabled = false,
  onFirstInteraction,
  onProjectDeleted
}: ActionsMenuProps) {
  const [gitHistoryOpen, setGitHistoryOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const navigate = useNavigate();
  const projectsManager = useProjectsManager();
  const { toast } = useToast();
  const { fs } = useFS();

  const isAnyLoading = isLoading || isBuildLoading || isDeployLoading || isDeleting || isExporting;

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

  const handleExportProject = async () => {
    setIsExporting(true);
    try {
      const zip = new JSZip();
      const projectPath = `/projects/${projectId}`;

      // Recursive function to add files and directories to zip from a specific project
      const addProjectToZip = async (dirPath: string, zipFolder: JSZip) => {
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = `${dirPath}/${entry.name}`;

            if (entry.isDirectory()) {
              // Create folder in zip and recursively add its contents
              const folder = zipFolder.folder(entry.name);
              if (folder) {
                await addProjectToZip(fullPath, folder);
              }
            } else if (entry.isFile()) {
              // Add file to zip
              try {
                const fileContent = await fs.readFile(fullPath);
                zipFolder.file(entry.name, fileContent);
              } catch (error) {
                console.warn(`Failed to read file ${fullPath}:`, error);
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to read directory ${dirPath}:`, error);
        }
      };

      // Start from the project directory
      await addProjectToZip(projectPath, zip);

      // Generate zip file
      const content = await zip.generateAsync({ type: 'blob' });

      // Create download link
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;

      // Generate filename with commit hash
      let filename = `${projectName}.zip`;
      try {
        // Get the current commit hash
        const commits = await git.log({
          fs,
          dir: projectPath,
          depth: 1,
        });

        if (commits.length > 0) {
          const commitHash = commits[0].oid.substring(0, 7); // Truncate to 7 characters
          filename = `${projectName}-${commitHash}.zip`;
        }
      } catch (error) {
        console.warn('Failed to get commit hash, using project name only:', error);
      }

      link.download = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Project exported successfully",
        description: `"${projectName}" has been downloaded as a zip file.`,
      });
    } catch (error) {
      console.error('Failed to export project:', error);
      toast({
        title: "Failed to export project",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
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
            onClick={() => setGitHistoryOpen(true)}
            disabled={isAnyLoading}
            className="gap-2"
          >
            <GitBranch className="h-4 w-4" />
            Git History
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleExportProject}
            disabled={isAnyLoading}
            className="gap-2"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isExporting ? 'Exporting...' : 'Export Project'}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              if (onFirstInteraction) onFirstInteraction();
              onBuild();
            }}
            disabled={isAnyLoading}
            className="gap-2"
          >
            {isBuildLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isBuildLoading ? 'Building...' : 'Build'}
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
      <GitHistoryDialog
        projectId={projectId}
        open={gitHistoryOpen}
        onOpenChange={setGitHistoryOpen}
      />
    </>
  );
}