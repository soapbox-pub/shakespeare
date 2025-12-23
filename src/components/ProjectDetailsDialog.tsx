import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type Project } from '@/lib/ProjectsManager';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';
import { useFS } from '@/hooks/useFS';
import { useFSPaths } from '@/hooks/useFSPaths';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Folder,
  Loader2,
  Save,
  DollarSign,
  ExternalLink,
  FileCode,
} from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { DotAI } from '@/lib/DotAI';
import { LabelSelector } from '@/components/labels/LabelSelector';
import { cn } from '@/lib/utils';

interface ProjectDetailsDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectDetailsDialog({ project, open, onOpenChange }: ProjectDetailsDialogProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newProjectName, setNewProjectName] = useState(project.id);
  const [totalCost, setTotalCost] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [templateInfo, setTemplateInfo] = useState<{ name: string; description: string; url: string } | null>(null);
  const { toast } = useToast();
  const { fs } = useFS();
  const { projectsPath } = useFSPaths();
  const projectsManager = useProjectsManager();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Reset state when project changes
  useEffect(() => {
    setNewProjectName(project.id);
    setIsRenaming(false);
  }, [project.id]);

  // Load total project cost and template info
  useEffect(() => {
    const loadProjectData = async () => {
      setIsLoading(true);
      try {
        const dotAI = new DotAI(fs, `${projectsPath}/${project.id}`);

        // Load cost
        const cost = await dotAI.readCost();
        setTotalCost(cost);

        // Load template info
        const template = await dotAI.readTemplate();
        setTemplateInfo(template);
      } catch (error) {
        console.warn('Failed to load project data:', error);
        setTotalCost(null);
        setTemplateInfo(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (open) {
      loadProjectData();
    }
  }, [fs, projectsPath, project.id, open]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-primary" />
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

          {/* Total Cost */}
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Total Cost:</span>
            {typeof totalCost === 'number' ? (
              <span className="font-mono">${totalCost.toFixed(2)}</span>
            ) : (
              isLoading ? (
                <Skeleton className="h-4 w-16" />
              ) : (
                <span>N/A</span>
              )
            )}
          </div>

          {/* Template Info */}
          <div className="flex items-center gap-2 text-sm">
            <FileCode className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Template:</span>
            <a
              href={templateInfo?.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn("flex items-center gap-1", { "text-primary hover:underline": !!templateInfo })}
            >
              {templateInfo ? (
                <>
                  <span>{templateInfo.name}</span>
                  <ExternalLink className="h-3 w-3" />
                </>
              ) : (
                isLoading ? (
                  <Skeleton className="h-4 w-24" />
                ) : (
                  <span>N/A</span>
                )
              )}
            </a>
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

          {/* Labels */}
          <LabelSelector projectId={project.id} />
        </div>
      </DialogContent>
    </Dialog>
  );
}