import { useState, useEffect } from 'react';
import { type Project } from '@/lib/ProjectsManager';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useGitStatus } from '@/hooks/useGitStatus';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  Folder,
  GitBranch,
  Package,
  FileText,
  GitCommit,
  GitMerge,
  Globe,
  Clock,
  User,
  Hash,
  AlertCircle,
  CheckCircle,
  Plus,
  Minus,
  Edit,
  Eye
} from 'lucide-react';

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
  const gitStatus = useGitStatus(project.id);

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

            {/* Git Status Information */}
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <GitCommit className="h-4 w-4" />
                Git Repository
              </h3>

              {gitStatus.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : !gitStatus.data?.isGitRepo ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  This project is not a Git repository
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Repository Status */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {/* Current Branch */}
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Branch:</span>
                      <Badge variant="outline" className="text-xs">
                        {gitStatus.data?.currentBranch || 'unknown'}
                      </Badge>
                    </div>

                    {/* Uncommitted Changes */}
                    <div className="flex items-center gap-2">
                      {gitStatus.data?.hasUncommittedChanges ? (
                        <>
                          <AlertCircle className="h-4 w-4 text-orange-500" />
                          <span className="text-muted-foreground">Status:</span>
                          <Badge variant="destructive" className="text-xs">
                            {gitStatus.data.changedFiles.length} uncommitted changes
                          </Badge>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-muted-foreground">Status:</span>
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                            Clean working tree
                          </Badge>
                        </>
                      )}
                    </div>

                    {/* Total Commits */}
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Commits:</span>
                      <span>{gitStatus.data?.totalCommits || 0}</span>
                    </div>

                    {/* All Branches */}
                    <div className="flex items-center gap-2">
                      <GitMerge className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Branches:</span>
                      <span>{gitStatus.data?.branches.length || 0}</span>
                    </div>
                  </div>

                  {/* Latest Commit */}
                  {gitStatus.data?.latestCommit && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Latest Commit
                      </h4>
                      <div className="bg-muted/30 rounded-md p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <GitCommit className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium break-words">
                              {gitStatus.data.latestCommit.message.split('\n')[0]}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {gitStatus.data.latestCommit.oid.substring(0, 7)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {gitStatus.data.latestCommit.author.name}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(gitStatus.data.latestCommit.author.timestamp * 1000).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Changed Files */}
                  {gitStatus.data?.hasUncommittedChanges && gitStatus.data.changedFiles.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Uncommitted Changes
                      </h4>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {gitStatus.data.changedFiles.map((file, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            {file.status === 'added' && <Plus className="h-3 w-3 text-green-500" />}
                            {file.status === 'modified' && <Edit className="h-3 w-3 text-blue-500" />}
                            {file.status === 'deleted' && <Minus className="h-3 w-3 text-red-500" />}
                            {file.status === 'untracked' && <Eye className="h-3 w-3 text-orange-500" />}
                            {file.status === 'staged' && <CheckCircle className="h-3 w-3 text-purple-500" />}
                            <span className="text-muted-foreground capitalize">{file.status}:</span>
                            <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">
                              {file.filepath}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Remotes */}
                  {gitStatus.data?.remotes && gitStatus.data.remotes.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Remote Repositories
                      </h4>
                      <div className="space-y-1">
                        {gitStatus.data.remotes.map((remote, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <Globe className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground font-medium">{remote.name}:</span>
                            <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono break-all">
                              {remote.url}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}