import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Settings,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { useGitStatus } from '@/hooks/useGitStatus';
import { useGitSettings } from '@/hooks/useGitSettings';
import { useGit } from '@/hooks/useGit';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostr } from '@nostrify/react';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { cn } from '@/lib/utils';
import { findCredentialsForRepo, getOriginDisplayName } from '@/lib/gitCredentials';
import { nip19 } from 'nostr-tools';

const GRASP_SERVERS = ["git.shakespeare.diy", "relay.ngit.dev", "gitnostr.com"];

interface GitDialogProps {
  projectId: string;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function GitDialog({ projectId, children, open, onOpenChange }: GitDialogProps) {
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isPushingToNostr, setIsPushingToNostr] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);
  const [pullResult, setPullResult] = useState<string | null>(null);
  const navigate = useNavigate();

  const { data: gitStatus, refetch: refetchGitStatus } = useGitStatus(projectId);
  const { settings } = useGitSettings();
  const { git } = useGit();
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();

  const projectPath = `/projects/${projectId}`;

  const handlePushToNostr = async () => {
    if (!user) {
      toast({
        title: "Cannot push to Nostr",
        description: "You must be logged in to push to Nostr",
        variant: "destructive",
      });
      return;
    }

    if (!gitStatus?.isGitRepo || !gitStatus.currentBranch) {
      toast({
        title: "Cannot push to Nostr",
        description: "Not a git repository or no current branch",
        variant: "destructive",
      });
      return;
    }

    setIsPushingToNostr(true);
    setPushResult(null);

    try {
      // Check if repo announcement already exists
      const existingRepoEvents = await nostr.query([{
        kinds: [30617],
        authors: [user.pubkey],
        '#d': [projectId],
        limit: 1,
      }], { signal: AbortSignal.timeout(5000) });

      if (existingRepoEvents.length > 0) {
        throw new Error(`Repository announcement already exists for project "${projectId}". Cannot create duplicate.`);
      }

      // Create repo announcement event (NIP-34 kind 30617)
      const cloneUrls = GRASP_SERVERS.map(server =>
        `https://${server}/${nip19.npubEncode(user.pubkey)}/${projectId}.git`
      );
      const relayUrls = GRASP_SERVERS.map(server => `wss://${server}`);

      await publishEvent({
        kind: 30617,
        content: "",
        tags: [
          ["d", projectId],
          ["clone", ...cloneUrls],
          ["relays", ...relayUrls],
        ],
      });

      // Get current repository state
      const refTags: string[][] = [];

      // First check if we have any commits at all
      try {
        const log = await git.log({ dir: projectPath, depth: 1 });
        if (log.length === 0) {
          throw new Error('Repository has no commits. Please make at least one commit before publishing to Nostr.');
        }
        console.log(`Repository has ${log.length} commit(s), latest: ${log[0].oid}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('no commits')) {
          throw error; // Re-throw our custom error
        }
        throw new Error('Repository has no commits. Please make at least one commit before publishing to Nostr.');
      }

      try {
        // Get all refs using listRefs
        const refs = await git.listRefs({ dir: projectPath });
        console.log('Found refs:', refs);

        for (const ref of refs) {
          try {
            const commitId = await git.resolveRef({
              dir: projectPath,
              ref,
            });
            if (ref.startsWith('refs/heads/') || ref.startsWith('refs/tags/')) {
              refTags.push([ref, commitId]);
            }
          } catch (error) {
            console.warn(`Failed to resolve ref ${ref}:`, error);
          }
        }
      } catch (error) {
        console.warn('Failed to list refs, trying alternative approach:', error);
      }

      // If no refs found, try to get the current branch directly
      if (refTags.length === 0) {
        try {
          const currentBranch = await git.currentBranch({ dir: projectPath });
          if (currentBranch) {
            const currentCommit = await git.resolveRef({
              dir: projectPath,
              ref: 'HEAD',
            });
            refTags.push([`refs/heads/${currentBranch}`, currentCommit]);
            console.log(`Added current branch: refs/heads/${currentBranch} -> ${currentCommit}`);
          } else {
            // Try to get HEAD directly even if no current branch
            try {
              const headCommit = await git.resolveRef({
                dir: projectPath,
                ref: 'HEAD',
              });
              refTags.push(['refs/heads/main', headCommit]); // Assume main branch
              console.log(`Added assumed main branch: refs/heads/main -> ${headCommit}`);
            } catch (headError) {
              console.warn('Failed to resolve HEAD directly:', headError);
            }
          }
        } catch (error) {
          console.warn('Failed to get current branch:', error);
        }
      }

      if (refTags.length === 0) {
        throw new Error('Could not determine repository state. The repository might not have any commits or branches.');
      }

      // Get HEAD reference
      let headRef: string | undefined;
      try {
        const currentBranch = await git.currentBranch({ dir: projectPath });
        if (currentBranch) {
          headRef = `ref: refs/heads/${currentBranch}`;
          console.log(`HEAD points to: ${headRef}`);
        } else {
          // HEAD is detached, use the commit ID directly
          const headValue = await git.resolveRef({
            dir: projectPath,
            ref: 'HEAD',
          });
          if (headValue) {
            headRef = headValue;
            console.log(`HEAD is detached at: ${headRef}`);
          }
        }
      } catch (error) {
        console.warn('Failed to resolve HEAD:', error);
      }

      // Create repo state event (NIP-34 kind 30618)
      await publishEvent({
        kind: 30618,
        content: "",
        tags: [
          ["d", projectId],
          ...refTags,
          ...(headRef ? [["HEAD", headRef]] : []),
        ],
      });

      // Set origin remote to Nostr URL
      const nostrUrl = `nostr://${nip19.npubEncode(user.pubkey)}/git.shakespeare.diy/${projectId}`;

      try {
        // Remove existing origin if it exists
        await git.deleteRemote({
          dir: projectPath,
          remote: 'origin',
        });
      } catch {
        // Ignore if origin doesn't exist
      }

      await git.addRemote({
        dir: projectPath,
        remote: 'origin',
        url: nostrUrl,
      });

      // Set nostr.repo config
      await git.setConfig({
        dir: projectPath,
        path: 'nostr.repo',
        value: nip19.naddrEncode({
          kind: 30617,
          pubkey: user.pubkey,
          identifier: projectId,
        }),
      });

      toast({
        title: "Repository published to Nostr",
        description: "Waiting for GRASP servers to update...",
      });

      setPushResult(`✅ Successfully published repository to Nostr`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setPushResult(`❌ Push to Nostr failed: ${errorMessage}`);
      toast({
        title: "Push to Nostr failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsPushingToNostr(false);
    }
  };

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
        dir: projectPath,
        remote: remote.name,
        ref: gitStatus.currentBranch,
        onAuth: (url) => findCredentialsForRepo(url, settings.credentials),
        signer: user?.signer, // For signing if pushing to Nostr
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
        dir: projectPath,
        ref: gitStatus.currentBranch,
        singleBranch: true,
        author: {
          name: 'shakespeare.diy',
          email: 'assistant@shakespeare.diy',
        },
        onAuth: (url) => findCredentialsForRepo(url, settings.credentials),
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

            {/* Credentials Status */}
            {gitStatus?.isGitRepo && gitStatus.remotes.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    Authentication
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/settings/git')}
                      className="h-7 gap-1 text-xs"
                    >
                      <Settings className="h-3 w-3" />
                      Settings
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    Credentials for push/pull operations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {gitStatus.remotes.map((remote) => {
                    const credentials = findCredentialsForRepo(remote.url, settings.credentials);
                    const originDisplayName = getOriginDisplayName(remote.url);

                    return (
                      <div key={remote.name} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{remote.name}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {originDisplayName}
                            </span>
                          </div>
                          {credentials ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-3 w-3" />
                              <span className="text-xs">Configured</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-amber-600">
                              <AlertTriangle className="h-3 w-3" />
                              <span className="text-xs">No credentials</span>
                            </div>
                          )}
                        </div>

                        {!credentials && (
                          <Alert className="border-amber-200 bg-amber-50">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription className="text-sm">
                              No credentials configured for {originDisplayName}.
                              Push/pull operations may fail for private repositories.{' '}
                              <button
                                onClick={() => navigate('/settings/git')}
                                className="underline hover:no-underline font-medium"
                              >
                                Configure credentials
                              </button>
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

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
                        disabled={isPulling || isPushing || isPushingToNostr}
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
                        disabled={isPushing || isPulling || isPushingToNostr || gitStatus.ahead === 0}
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

                  {/* Push to Nostr button when no remote is configured and user is logged in */}
                  {gitStatus.remotes.length === 0 && user && (
                    <div className="flex gap-2">
                      <Button
                        onClick={handlePushToNostr}
                        disabled={isPushingToNostr || isPushing || isPulling}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        {isPushingToNostr ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Zap className="h-4 w-4 mr-2" />
                        )}
                        {isPushingToNostr ? 'Publishing to Nostr...' : 'Push to Nostr'}
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