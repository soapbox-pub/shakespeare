import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type Project } from '@/lib/ProjectsManager';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';
import { useFS } from '@/hooks/useFS';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Folder,
  Download,
  Loader2,
  Trash2,
  Save,
} from 'lucide-react';
import JSZip from 'jszip';
import { Separator } from './ui/separator';

interface ProjectDetailsDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectDeleted?: () => void;
}

export function ProjectDetailsDialog({ project, open, onOpenChange, onProjectDeleted }: ProjectDetailsDialogProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newProjectName, setNewProjectName] = useState(project.id);
  const { toast } = useToast();
  const { fs } = useFS();
  const projectsManager = useProjectsManager();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Reset state when project changes
  useEffect(() => {
    setNewProjectName(project.id);
    setIsRenaming(false);
  }, [project.id]);

  const formatDistanceToNow = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
    return `${Math.floor(diffInSeconds / 31536000)} years ago`;
  };

  const handleSaveProject = async () => {
    if (!newProjectName.trim() || newProjectName === project.id) {
      setNewProjectName(project.id);
      return;
    }

    setIsRenaming(true);
    try {
      await projectsManager.renameProject(project.id, newProjectName);

      // Invalidate the projects query to update the sidebar
      await queryClient.invalidateQueries({ queryKey: ['projects'] });

      toast({
        title: "Project renamed",
        description: `Project renamed from "${project.id}" to "${newProjectName}".`,
      });

      // Close the dialog first
      onOpenChange(false);

      // Navigate to the new URL
      navigate(`/project/${newProjectName}`);
    } catch (error) {
      toast({
        title: "Failed to rename project",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
      setNewProjectName(project.id); // Reset to original name
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteProject = async () => {
    setIsDeleting(true);
    try {
      await projectsManager.deleteProject(project.id);

      // Invalidate the projects query to update the sidebar
      await queryClient.invalidateQueries({ queryKey: ['projects'] });

      toast({
        title: "Project deleted",
        description: `"${project.name}" has been permanently deleted.`,
      });

      // Close the dialog first
      onOpenChange(false);

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
      const projectPath = `/projects/${project.id}`;

      // Recursive function to add files and directories to zip from a specific project
      const addFolderToZip = async (dirPath: string, zipFolder: JSZip) => {
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = `${dirPath}/${entry.name}`;

            if (entry.isDirectory()) {
              // Create folder in zip and recursively add its contents
              const folder = zipFolder.folder(entry.name);
              if (folder) {
                await addFolderToZip(fullPath, folder);
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
      await addFolderToZip(projectPath, zip);

      // Generate zip file
      const content = await zip.generateAsync({ type: 'blob' });

      // Create download link
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.id}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Project exported successfully",
        description: `"${project.name}" has been downloaded as a zip file.`,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            {project.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Last Modified */}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Last Modified:</span>
            <span>{formatDistanceToNow(project.lastModified)}</span>
          </div>

          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <div className="flex items-center gap-2">
              <Input
                id="project-name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                disabled={isRenaming}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveProject();
                  } else if (e.key === 'Escape') {
                    setNewProjectName(project.id);
                  }
                }}
                className="flex-1"
                placeholder="Enter project name"
              />
              <Button
                size="sm"
                onClick={handleSaveProject}
                disabled={isRenaming || !newProjectName.trim() || newProjectName === project.id}
                className="h-10"
              >
                {isRenaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Export Project Button */}
          <Button
            onClick={handleExportProject}
            disabled={isExporting || isDeleting || isRenaming}
            className="w-full gap-2"
            variant="outline"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isExporting ? 'Exporting...' : 'Export Project'}
          </Button>

          {/* Delete Project Button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="w-full gap-2"
                disabled={isExporting || isDeleting || isRenaming}
              >
                <Trash2 className="h-4 w-4" />
                Delete Project
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{project.name}"? This action cannot be undone and will permanently delete all project data including files.
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
        </div>
      </DialogContent>
    </Dialog>
  );
}