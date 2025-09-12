import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  GitBranch,
  Upload,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  FileIcon,
  Plus,
  Minus,
  Edit,
  RefreshCw,
} from 'lucide-react';
import { useGitStatus } from '@/hooks/useGitStatus';
import { useFS } from '@/hooks/useFS';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';

interface GitDialogProps {
  projectId: string;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function GitDialog({ projectId, children, open, onOpenChange }: GitDialogProps) {
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);
  const [pullResult, setPullResult] = useState<string | null>(null);

  const { data: gitStatus, refetch: refetchGitStatus } = useGitStatus(projectId);
  const { fs } = useFS();
  const { toast } = useToast();

  const projectPath = `/projects/${projectId}`;

  const handlePush = async () => {
    if (!gitStatus?.isGitRepo || !gitStatus.currentBranch) {
      toast({
        title: "Cannot push",
        description: "Not a git repository or no current branch",
        variant: "destructive",
      });
      return;
    }

    if (gitStatus.remotes.length === 0) {
      toast({
        title: "Cannot push",
        description: "No remote repositories configured",
        variant: "destructive",
      });
      return;
    }

    if (gitStatus.ahead === 0) {
      toast({
        title: "Nothing to push",
        description: "No commits ahead of remote. Commit your changes first.",
        variant: "destructive",
      });
      return;
    }

    setIsPushing(true);
    setPushResult(null);

    try {
      const remote = gitStatus.remotes[0]; // Use first remote (usually 'origin')

      await git.push({
        fs,
        http,
        dir: projectPath,
        remote: remote.name,
        ref: gitStatus.currentBranch,
        corsProxy: 'https://cors.isomorphic-git.org',
      });

      setPushResult(`✅ Successfully pushed ${gitStatus.ahead} commit${gitStatus.ahead !== 1 ? 's' : ''} to ${remote.name}/${gitStatus.currentBranch}`);
      toast({
        title: "Push successful",
        description: `${gitStatus.ahead} commit${gitStatus.ahead !== 1 ? 's' : ''} pushed to ${remote.name}/${gitStatus.currentBranch}`,
      });

      // Refresh git status after push
      await refetchGitStatus();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setPushResult(`❌ Push failed: ${errorMessage}`);
      toast({
        title: "Push failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsPushing(false);
    }
  };

  const handlePull = async () => {
    if (!gitStatus?.isGitRepo || !gitStatus.currentBranch) {
      toast({
        title: "Cannot pull",
        description: "Not a git repository or no current branch",
        variant: "destructive",
      });
      return;
    }

    if (gitStatus.remotes.length === 0) {
      toast({
        title: "Cannot pull",
        description: "No remote repositories configured",
        variant: "destructive",
      });
      return;
    }

    setIsPulling(true);
    setPullResult(null);

    try {
      const remote = gitStatus.remotes[0]; // Use first remote (usually 'origin')

      await git.pull({
        fs,
        http,
        dir: projectPath,
        ref: gitStatus.currentBranch,
        singleBranch: true,
        corsProxy: 'https://cors.isomorphic-git.org',
        author: {
          name: 'shakespeare.diy',
          email: 'assistant@shakespeare.diy',
        },
      });

      setPullResult(`✅ Successfully pulled from ${remote.name}/${gitStatus.currentBranch}`);
      toast({
        title: "Pull successful",
        description: `Latest changes pulled from ${remote.name}/${gitStatus.currentBranch}`,
      });

      // Refresh git status after pull
      await refetchGitStatus();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setPullResult(`❌ Pull failed: ${errorMessage}`);
      toast({
        title: "Pull failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsPulling(false);
    }
  };

  const handleRefresh = async () => {
    await refetchGitStatus();
    setPushResult(null);
    setPullResult(null);
  };

  const getFileStatusIcon = (status: string) => {
    switch (status) {
      case 'added':
        return <Plus className="h-3 w-3 text-green-500" />;
      case 'deleted':
        return <Minus className="h-3 w-3 text-red-500" />;
      case 'modified':
        return <Edit className="h-3 w-3 text-blue-500" />;
      case 'staged':
        return <CheckCircle className="h-3 w-3 text-green-600" />;
      case 'untracked':
        return <FileIcon className="h-3 w-3 text-gray-500" />;
      default:
        return <FileIcon className="h-3 w-3" />;
    }
  };

  const getFileStatusColor = (status: string) => {
    switch (status) {
      case 'added':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'deleted':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'modified':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'staged':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'untracked':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSyncStatus = () => {
    if (!gitStatus?.isGitRepo) {
      return { status: 'not-repo', text: 'Not a Git repository', icon: AlertCircle, color: 'text-gray-500' };
    }

    if (gitStatus.remotes.length === 0) {
      return { status: 'no-remote', text: 'No remote configured', icon: AlertCircle, color: 'text-yellow-600' };
    }

    if (gitStatus.ahead > 0 && gitStatus.behind > 0) {
      return { status: 'diverged', text: `${gitStatus.ahead} ahead, ${gitStatus.behind} behind`, icon: AlertCircle, color: 'text-red-600' };
    }

    if (gitStatus.ahead > 0) {
      return { status: 'ahead', text: `${gitStatus.ahead} commit${gitStatus.ahead !== 1 ? 's' : ''} ahead`, icon: Upload, color: 'text-blue-600' };
    }

    // Show uncommitted changes but with different styling since they can't be pushed directly
    if (gitStatus.hasUncommittedChanges) {
      return { status: 'uncommitted', text: `${gitStatus.changedFiles.length} uncommitted change${gitStatus.changedFiles.length !== 1 ? 's' : ''}`, icon: Clock, color: 'text-yellow-600' };
    }

    if (gitStatus.behind > 0) {
      return { status: 'behind', text: `${gitStatus.behind} commit${gitStatus.behind !== 1 ? 's' : ''} behind`, icon: Download, color: 'text-orange-600' };
    }

    return { status: 'synced', text: 'Up to date', icon: CheckCircle, color: 'text-green-600' };
  };

  const syncStatus = getSyncStatus();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Git Repository Status
          </DialogTitle>
          <DialogDescription>
            View repository status and sync with remote repositories
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4">
            {/* Repository Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  Repository Information
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefresh}
                    className="h-7 w-7 p-0"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {gitStatus?.isGitRepo ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Current Branch:</span>
                      <Badge variant="outline" className="font-mono">
                        {gitStatus.currentBranch || 'unknown'}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Commits:</span>
                      <Badge variant="secondary">{gitStatus.totalCommits}</Badge>
                    </div>

                    {gitStatus.latestCommit && (
                      <div className="space-y-2">
                        <span className="text-sm text-muted-foreground">Latest Commit:</span>
                        <div className="bg-muted/50 rounded-md p-2 space-y-1">
                          <div className="font-mono text-xs text-muted-foreground">
                            {gitStatus.latestCommit.oid.substring(0, 7)}
                          </div>
                          <div className="text-sm">{gitStatus.latestCommit.message}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(gitStatus.latestCommit.author.timestamp * 1000).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )}

                    {gitStatus.remotes.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-sm text-muted-foreground">Remotes:</span>
                        {gitStatus.remotes.map((remote) => (
                          <div key={remote.name} className="bg-muted/50 rounded-md p-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline">{remote.name}</Badge>
                              <span className="font-mono text-xs text-muted-foreground truncate ml-2">
                                {remote.url}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>Not a Git repository</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sync Status */}
            {gitStatus?.isGitRepo && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Sync Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-4">
                    <syncStatus.icon className={cn("h-4 w-4", syncStatus.color)} />
                    <span className={cn("text-sm font-medium", syncStatus.color)}>
                      {syncStatus.text}
                    </span>
                  </div>

                  {gitStatus.remotes.length > 0 && (
                    <div className="flex gap-2">
                      <Button
                        onClick={handlePull}
                        disabled={isPulling || isPushing}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        {isPulling ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        {isPulling ? 'Pulling...' : 'Pull'}
                      </Button>

                      <Button
                        onClick={handlePush}
                        disabled={isPushing || isPulling || gitStatus.ahead === 0}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        {isPushing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {isPushing ? 'Pushing...' : 'Push'}
                      </Button>
                    </div>
                  )}

                  {/* Operation Results */}
                  {(pushResult || pullResult) && (
                    <div className="mt-3 space-y-2">
                      {pushResult && (
                        <div className="text-xs font-mono bg-muted/50 rounded p-2">
                          {pushResult}
                        </div>
                      )}
                      {pullResult && (
                        <div className="text-xs font-mono bg-muted/50 rounded p-2">
                          {pullResult}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Working Directory Changes */}
            {gitStatus?.isGitRepo && gitStatus.changedFiles.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Working Directory Changes</CardTitle>
                  <CardDescription>
                    {gitStatus.changedFiles.length} file{gitStatus.changedFiles.length !== 1 ? 's' : ''} with changes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {gitStatus.changedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 rounded-md border bg-muted/20"
                      >
                        {getFileStatusIcon(file.status)}
                        <span className="font-mono text-sm flex-1 truncate">
                          {file.filepath}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", getFileStatusColor(file.status))}
                        >
                          {file.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Clean Working Directory */}
            {gitStatus?.isGitRepo && gitStatus.changedFiles.length === 0 && (
              <Card>
                <CardContent className="py-6">
                  <div className="text-center text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p>Working directory is clean</p>
                    <p className="text-xs">No uncommitted changes</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}