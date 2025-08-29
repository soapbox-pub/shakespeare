import { useState, useEffect } from 'react';
import { type Project } from '@/lib/ProjectsManager';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, Folder, GitBranch, Package, FileText } from 'lucide-react';

interface ProjectInfoDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProjectMetadata {
  description?: string;
  version?: string;
  nostrRepoAddress?: string;
  fileCount?: number;
}

export function ProjectInfoDialog({ project, open, onOpenChange }: ProjectInfoDialogProps) {
  const [metadata, setMetadata] = useState<ProjectMetadata>({});
  const [isLoading, setIsLoading] = useState(false);
  const projectsManager = useProjectsManager();

  useEffect(() => {
    if (!open) return;

    const loadProjectMetadata = async () => {
      setIsLoading(true);
      try {
        const meta: ProjectMetadata = {};

        // Try to read package.json
        try {
          const packageJsonContent = await projectsManager.readFile(project.id, 'package.json');
          const packageJson = JSON.parse(packageJsonContent);
          meta.description = packageJson.description;
          meta.version = packageJson.version;
        } catch {
          // package.json doesn't exist or is invalid
        }

        // Get Nostr repo address
        try {
          const repoAddress = await projectsManager.getNostrRepoAddress(project.id);
          if (repoAddress) {
            meta.nostrRepoAddress = repoAddress;
          }
        } catch {
          // No Nostr repo configured
        }

        // Calculate file count and size (simplified)
        try {
          const files = await projectsManager.listFiles(project.id);
          meta.fileCount = files.length;
        } catch {
          // Can't read directory
        }

        setMetadata(meta);
      } catch (error) {
        console.error('Failed to load project metadata:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProjectMetadata();
  }, [open, project.id, projectsManager]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            {project.name}
          </DialogTitle>
          <DialogDescription>
            Project information and metadata
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Basic Information
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Project ID:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{project.id}</code>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Last Modified:</span>
                  <span>{formatDistanceToNow(project.lastModified)}</span>
                </div>
                {metadata.version && (
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Version:</span>
                    <Badge variant="secondary">{metadata.version}</Badge>
                  </div>
                )}
                {metadata.fileCount !== undefined && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Files:</span>
                    <span>{metadata.fileCount}</span>
                  </div>
                )}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Created:</span>
                <span className="ml-2">{formatDate(project.lastModified)}</span>
              </div>
              {metadata.description && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Description:</span>
                  <p className="mt-1 text-foreground">{metadata.description}</p>
                </div>
              )}
            </div>

            {/* Nostr Information */}
            {metadata.nostrRepoAddress && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    Nostr Repository
                  </h3>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Repository Address:</span>
                    <code className="ml-2 bg-muted px-1.5 py-0.5 rounded text-xs break-all">
                      {metadata.nostrRepoAddress}
                    </code>
                  </div>
                </div>
              </>
            )}


          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}