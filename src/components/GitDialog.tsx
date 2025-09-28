import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  AlertTriangle,
  Zap,
  Save,
} from 'lucide-react';
import { useGitStatus } from '@/hooks/useGitStatus';
import { useGitSettings } from '@/hooks/useGitSettings';
import { useGit } from '@/hooks/useGit';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostr } from '@nostrify/react';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { cn } from '@/lib/utils';
import { findCredentialsForRepo } from '@/lib/gitCredentials';
import { nip19 } from 'nostr-tools';

const GRASP_SERVERS = ["git.shakespeare.diy", "relay.ngit.dev"];

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
  const [originUrl, setOriginUrl] = useState('');
  const [isSavingOrigin, setIsSavingOrigin] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const { data: gitStatus, refetch: refetchGitStatus } = useGitStatus(projectId);
  const { settings } = useGitSettings();
  const { git } = useGit();
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();

  const projectPath = `/projects/${projectId}`;

  // Initialize origin URL from git status
  useEffect(() => {
    if (gitStatus?.remotes) {
      const originRemote = gitStatus.remotes.find(remote => remote.name === 'origin');
      setOriginUrl(originRemote?.url || '');
    }
  }, [gitStatus?.remotes]);

  const handleSaveOrigin = async () => {
    if (!gitStatus?.isGitRepo) {
      toast({
        title: "Cannot configure origin",
        description: "Not a git repository",
        variant: "destructive",
      });
      return;
    }

    setIsSavingOrigin(true);

    try {
      // Remove existing origin if it exists
      try {
        await git.deleteRemote({
          dir: projectPath,
          remote: 'origin',
        });
      } catch {
        // Ignore if origin doesn't exist
      }

      // Add new origin if URL is provided
      if (originUrl.trim()) {
        await git.addRemote({
          dir: projectPath,
          remote: 'origin',
          url: originUrl.trim(),
        });

        toast({
          title: "Origin configured",
          description: `Origin remote set to ${originUrl.trim()}`,
        });
      } else {
        toast({
          title: "Origin removed",
          description: "Origin remote has been removed",
        });
      }

      // Refresh git status after changing origin
      await refetchGitStatus();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Failed to configure origin",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSavingOrigin(false);
    }
  };

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

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Push to Nostr failed",
        description: errorMessage,
        variant: "destructive",
        duration: Infinity,
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

    try {
      const remote = gitStatus.remotes[0]; // Use first remote (usually 'origin')

      await git.push({
        dir: projectPath,
        remote: remote.name,
        ref: gitStatus.currentBranch,
        onAuth: (url) => findCredentialsForRepo(url, settings.credentials),
        signer: user?.signer, // For signing if pushing to Nostr
      });


      toast({
        title: "Push successful",
        description: `${gitStatus.ahead} commit${gitStatus.ahead !== 1 ? 's' : ''} pushed to ${remote.name}/${gitStatus.currentBranch}`,
      });

      // Refresh git status after push
      await refetchGitStatus();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Push failed",
        description: errorMessage,
        variant: "destructive",
        duration: Infinity,
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

    try {
      const remote = gitStatus.remotes[0]; // Use first remote (usually 'origin')

      // Get the current HEAD commit before pulling
      const beforeCommit = await git.resolveRef({
        dir: projectPath,
        ref: 'HEAD',
      });

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

      // Get the current HEAD commit after pulling
      const afterCommit = await git.resolveRef({
        dir: projectPath,
        ref: 'HEAD',
      });

      // Check if the repository actually changed
      const repoChanged = beforeCommit !== afterCommit;

      toast({
        title: "Pull successful",
        description: repoChanged
          ? `Latest changes pulled from ${remote.name}/${gitStatus.currentBranch}`
          : `Already up to date with ${remote.name}/${gitStatus.currentBranch}`,
      });

      // Refresh git status after pull
      await refetchGitStatus();

      // Only trigger build if the repository actually changed
      if (repoChanged) {
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.set('build', '');
        setSearchParams(newSearchParams);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Pull failed",
        description: errorMessage,
        variant: "destructive",
        duration: Infinity,
      });
    } finally {
      setIsPulling(false);
    }
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
      <DialogContent className="max-w-2xl max-h-[80vh]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Repository
          </DialogTitle>
        </DialogHeader>

        {/* URL Configuration */}
        {gitStatus?.isGitRepo && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Git URL</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="origin-url" className="sr-only">
                    URL
                  </Label>
                  <Input
                    id="origin-url"
                    placeholder="https://github.com/username/repository.git"
                    value={originUrl}
                    onChange={(e) => setOriginUrl(e.target.value)}
                    disabled={isSavingOrigin}
                  />
                </div>
                <Button
                  onClick={handleSaveOrigin}
                  disabled={isSavingOrigin}
                  variant="outline"
                  size="sm"
                  className="h-10 shrink-0"
                >
                  {isSavingOrigin ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {isSavingOrigin ? 'Saving...' : 'Save'}
                </Button>
              </div>

              {/* Credentials Warning */}
              {gitStatus.remotes.length > 0 && (
                (() => {
                  const remoteWithoutCredentials = gitStatus.remotes.find((remote) => !findCredentialsForRepo(remote.url, settings.credentials));
                  if (!remoteWithoutCredentials) return null;

                  let protocol = '';
                  let hostname = 'the remote host';
                  try {
                    const url = new URL(remoteWithoutCredentials.url);
                    protocol = url.protocol;
                    hostname = url.hostname;
                  } catch {
                    // Invalid URL
                    return (
                      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          Invalid URL format. Enter an https URL.
                        </AlertDescription>
                      </Alert>
                    );
                  }

                  // Check for unsupported protocols
                  if (protocol !== 'https:' && protocol !== 'nostr:') {
                    return (
                      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          The {protocol.replace(':', '')} URL type is not supported. Enter an https URL.
                        </AlertDescription>
                      </Alert>
                    );
                  }

                  // For nostr protocol, only show warning if user is not logged in
                  if (protocol === 'nostr:' && !user) {
                    return (
                      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          You are not logged into Nostr. Push & pull might not work unless you{' '}
                          <button
                            onClick={() => navigate('/settings/nostr')}
                            className="underline hover:no-underline font-medium text-amber-700 dark:text-amber-300"
                          >
                            log in
                          </button>.
                        </AlertDescription>
                      </Alert>
                    );
                  }

                  // For https protocol, show warning if no credentials
                  if (protocol === 'https:') {
                    return (
                      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          You are not logged into {hostname}. Push & pull might not work unless you{' '}
                          <button
                            onClick={() => navigate('/settings/git')}
                            className="underline hover:no-underline font-medium text-amber-700 dark:text-amber-300"
                          >
                            log in
                          </button>.
                        </AlertDescription>
                      </Alert>
                    );
                  }

                  return null;
                })()
              )}
            </CardContent>
          </Card>
        )}

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4">

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