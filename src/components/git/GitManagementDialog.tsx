import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  GitBranch,
  GitMerge,
  GitPullRequest,
  ExternalLink,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { DiffViewer } from './DiffViewer';
import { MergeDialog } from './MergeDialog';
import { PullRequestForm } from './PullRequestForm';
import { useGitStatus } from '@/hooks/useGitStatus';
import { useGit } from '@/hooks/useGit';
import { useGitSettings } from '@/hooks/useGitSettings';
import { useToast } from '@/hooks/useToast';
import { findCredentialsForRepo } from '@/lib/gitCredentials';
import { BranchManager } from './BranchManager';

interface GitManagementDialogProps {
  projectId: string;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultTab?: string;
}

interface PullRequest {
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  html_url: string;
  created_at: string;
  head: {
    ref: string;
  };
  base: {
    ref: string;
  };
}

export function GitManagementDialog({
  projectId,
  children,
  open,
  onOpenChange,
}: GitManagementDialogProps) {
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [showPRForm, setShowPRForm] = useState(false);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [isLoadingPRs, setIsLoadingPRs] = useState(false);
  const [showBranchManager, setShowBranchManager] = useState(false);

  const { git } = useGit();
  const { settings } = useGitSettings();
  const { toast } = useToast();
  const projectPath = `/projects/${projectId}`;

  const { data: gitStatus, refetch: refetchGitStatus } = useGitStatus(projectId);

  useEffect(() => {
    const loadRemoteUrl = async () => {
      try {
        const url = await git.getRemoteURL(projectPath, 'origin');
        setRemoteUrl(url);
      } catch {
        setRemoteUrl(null);
      }
    };
    if (open) {
      loadRemoteUrl();
    }
  }, [open, git, projectPath]);

  const loadPullRequests = useCallback(async () => {
    if (!remoteUrl) return;

    setIsLoadingPRs(true);
    try {
      const credentials = findCredentialsForRepo(remoteUrl, settings.credentials);
      if (!credentials) {
        setPullRequests([]);
        return;
      }

      // Parse GitHub/GitLab URL
      let match;
      let owner = '';
      let repo = '';
      let apiUrl = '';

      const normalizedUrl = remoteUrl.replace(/\.git$/, '');

      // GitHub
      match = normalizedUrl.match(/git@github\.com:([^/]+)\/(.+)$/) ||
              normalizedUrl.match(/https?:\/\/github\.com\/([^/]+)\/(.+)$/);
      if (match) {
        owner = match[1];
        repo = match[2];
        apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls`;
      }

      // GitLab
      if (!match) {
        match = normalizedUrl.match(/git@gitlab\.com:([^/]+)\/(.+)$/) ||
                normalizedUrl.match(/https?:\/\/gitlab\.com\/([^/]+)\/(.+)$/);
        if (match) {
          owner = match[1];
          repo = match[2];
          apiUrl = `https://gitlab.com/api/v4/projects/${encodeURIComponent(`${owner}/${repo}`)}/merge_requests`;
        }
      }

      if (!apiUrl) {
        setPullRequests([]);
        return;
      }

      // Get current user to filter PRs
      const response = await fetch(`${apiUrl}?state=open`, {
        headers: {
          'Authorization': `token ${credentials.password}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pull requests');
      }

      const data = await response.json();

      // Filter PRs authored by current user (based on credentials username)
      const userPRs = Array.isArray(data)
        ? data.filter((pr: any) =>
            pr.user?.login === credentials.username ||
            pr.author?.username === credentials.username
          )
        : [];

      setPullRequests(userPRs);
    } catch (err) {
      console.error('Failed to load pull requests:', err);
      setPullRequests([]);
    } finally {
      setIsLoadingPRs(false);
    }
  }, [remoteUrl, settings.credentials]);

  useEffect(() => {
    if (open && remoteUrl) {
      loadPullRequests();
    }
  }, [open, remoteUrl, loadPullRequests]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const credentials = findCredentialsForRepo(remoteUrl || '', settings.credentials);

      // Pull
      await git.pull({
        dir: projectPath,
        author: {
          name: credentials?.username || 'shakespeare.diy',
          email: credentials?.email || 'assistant@shakespeare.diy',
        },
        onAuth: () => credentials || undefined,
      });

      // Push
      await git.push({
        dir: projectPath,
        onAuth: () => credentials || undefined,
      });

      toast({
        title: 'Sync successful',
        description: 'Your changes have been synchronized',
      });

      refetchGitStatus();
    } catch (err) {
      toast({
        title: 'Sync failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleBranchChange = () => {
    refetchGitStatus();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {children && <DialogTrigger asChild>{children}</DialogTrigger>}
        <DialogContent className="max-w-6xl h-[90vh] p-0 flex flex-col gap-0">
          {/* Fixed Header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Repository
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Section 1: Git URL, Current Branch, Sync Status, Merge Branch */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Repository Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Git URL */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">Git URL</div>
                    <div className="font-mono text-sm bg-muted/50 p-2 rounded break-all">
                      {remoteUrl || 'No remote configured'}
                    </div>
                  </div>

                  {/* Current Branch */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">Current Branch</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        {gitStatus?.currentBranch || 'Unknown'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowBranchManager(!showBranchManager)}
                        className="h-7 text-xs"
                      >
                        {showBranchManager ? 'Hide' : 'Manage'} Branches
                      </Button>
                    </div>
                  </div>

                  {/* Branch Manager (collapsible) */}
                  {showBranchManager && (
                    <div className="pt-2 border-t">
                      <BranchManager
                        projectId={projectId}
                        currentBranch={gitStatus?.currentBranch || null}
                        onBranchChange={handleBranchChange}
                      />
                    </div>
                  )}

                  {/* Sync Status */}
                  {remoteUrl && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">Sync Status</div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSync}
                          disabled={isSyncing}
                          className="gap-2"
                        >
                          {isSyncing ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Syncing...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4" />
                              Sync
                            </>
                          )}
                        </Button>
                        {gitStatus && (
                          <div className="text-sm text-muted-foreground">
                            {gitStatus.modified + gitStatus.added + gitStatus.deleted > 0
                              ? `${gitStatus.modified + gitStatus.added + gitStatus.deleted} changes`
                              : 'Up to date'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Merge Branch Action */}
                  <div className="pt-2 border-t">
                    <MergeDialog
                      projectId={projectId}
                      currentBranch={gitStatus?.currentBranch || null}
                      open={isMergeDialogOpen}
                      onOpenChange={setIsMergeDialogOpen}
                      onMergeComplete={() => {
                        refetchGitStatus();
                        setIsMergeDialogOpen(false);
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Section 2: Pull Requests */}
              {remoteUrl && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Pull Requests</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPRForm(!showPRForm)}
                        className="gap-2"
                      >
                        <GitPullRequest className="h-4 w-4" />
                        {showPRForm ? 'Hide Form' : 'Create PR'}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* PR Form (collapsible) */}
                    {showPRForm && (
                      <div className="pb-4 border-b">
                        <PullRequestForm
                          projectId={projectId}
                          currentBranch={gitStatus?.currentBranch || null}
                          remoteUrl={remoteUrl}
                        />
                      </div>
                    )}

                    {/* Your Open PRs */}
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">Your Open PRs</div>
                      {isLoadingPRs ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : pullRequests.length > 0 ? (
                        <div className="space-y-2">
                          {pullRequests.map((pr) => (
                            <div
                              key={pr.number}
                              className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                            >
                              <div className="mt-0.5">
                                {pr.state === 'open' && <GitPullRequest className="h-4 w-4 text-green-600" />}
                                {pr.state === 'merged' && <CheckCircle className="h-4 w-4 text-purple-600" />}
                                {pr.state === 'closed' && <XCircle className="h-4 w-4 text-red-600" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">{pr.title}</div>
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                  <span>#{pr.number}</span>
                                  <span>•</span>
                                  <span>{pr.head.ref} → {pr.base.ref}</span>
                                  <span>•</span>
                                  <span>{formatDate(pr.created_at)}</span>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 shrink-0"
                                onClick={() => window.open(pr.html_url, '_blank')}
                              >
                                View
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <GitPullRequest className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No open pull requests</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Section 3: Working Directory */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Working Directory</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <DiffViewer
                    projectId={projectId}
                    compareFrom="HEAD"
                  />
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
