import { useState, useCallback, useEffect } from 'react';
import { Zap, Copy, Check, RefreshCw, EllipsisVertical, CloudOff, ExternalLink, ChevronDown, ArrowDown, ArrowUp, LoaderCircle, History, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useQueryClient } from '@tanstack/react-query';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ExternalFavicon } from '@/components/ExternalFavicon';
import { SyncStepError } from './SyncStepError';
import { ForcePullDialog } from './ForcePullDialog';
import { ForcePushDialog } from './ForcePushDialog';
import { GitHistoryDialog } from '@/components/ai/GitHistoryDialog';
import { NostrRepoEditDialog } from '@/components/NostrRepoEditDialog';
import { useGitStatus } from '@/hooks/useGitStatus';
import { useGitSettings } from '@/hooks/useGitSettings';
import { useGit } from '@/hooks/useGit';
import { useFSPaths } from '@/hooks/useFSPaths';
import { useAppContext } from '@/hooks/useAppContext';
import { useGitSyncState } from '@/hooks/useGitSyncState';
import { useGitAutosync } from '@/hooks/useGitAutosync';
import { useNostrRepo } from '@/hooks/useNostrRepo';
import type { SyncStepProps } from '../types';
import { cn } from '@/lib/utils';
import { NostrURI } from '@/lib/NostrURI';
import { ngitWebUrl } from '@/lib/ngitWebUrl';
import { findCredentialsForRepo } from '@/lib/gitCredentials';

export function SyncStep({ projectId, remoteUrl }: SyncStepProps) {
  const queryClient = useQueryClient();

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showForcePullDialog, setShowForcePullDialog] = useState(false);
  const [showForcePushDialog, setShowForcePushDialog] = useState(false);
  const [gitHistoryOpen, setGitHistoryOpen] = useState(false);
  const [editRepoOpen, setEditRepoOpen] = useState(false);
  const [repoIdentifier, setRepoIdentifier] = useState<string | null>(null);

  const { data: gitStatus } = useGitStatus(projectId);
  const { settings } = useGitSettings();
  const { git } = useGit();
  const { projectsPath } = useFSPaths();
  const { config } = useAppContext();
  const gitSync = useGitSyncState();

  const dir = `${projectsPath}/${projectId}`;
  const ref = gitStatus?.currentBranch || 'main';

  // Use the new hook for autosync state
  const { autosync, isLoading: isLoadingAutosync, setAutosync } = useGitAutosync(dir);

  // Get unified sync state and error
  const syncState = gitSync.getState(dir);
  const isSyncing = syncState?.isActive || false;
  const currentOperation = syncState?.operation || null;
  const error = gitSync.getError(dir) || null;

  const hasRemoteChanges = gitStatus?.remoteBranchExists && ((gitStatus?.ahead ?? 0) > 0 || (gitStatus?.behind ?? 0) > 0);
  const commitsAhead = gitStatus?.ahead ?? 0;
  const commitsBehind = gitStatus?.behind ?? 0;

  // Helper to set error for this directory
  const setError = useCallback((err: Error | null) => {
    gitSync.setError(dir, err);
  }, [dir, gitSync]);

  // Generic git operation handler with success feedback
  const executeGitOperation = useCallback(async (
    action: () => Promise<void>
  ) => {
    if (!remoteUrl) return;

    setError(null);
    setSyncSuccess(false);

    try {
      await action();

      // Show success feedback
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 2500);
    } catch (err) {
      console.warn(err);
      // Error is already set by the provider
    }
  }, [remoteUrl, setError]);

  const handleSync = async () => {
    await executeGitOperation(() => gitSync.sync(dir, ref));
  };

  const handlePull = async () => {
    await executeGitOperation(() => gitSync.pull(dir, ref));
  };

  const handlePush = async () => {
    await executeGitOperation(() => gitSync.push(dir, ref));
  };

  const handleForcePull = async () => {
    await executeGitOperation(() => gitSync.forcePull(dir, ref));
  };

  const handleForcePush = async () => {
    await executeGitOperation(() => gitSync.forcePush(dir, ref));
  };

  // Temporary feedback state helper
  const showTemporaryFeedback = useCallback((
    setter: (value: boolean) => void,
    duration: number
  ) => {
    setter(true);
    setTimeout(() => setter(false), duration);
  }, []);

  const handleCopyUrl = async () => {
    if (!remoteUrl) return;

    try {
      await navigator.clipboard.writeText(remoteUrl.href);
      showTemporaryFeedback(setCopiedUrl, 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleDisconnect = async () => {
    if (!remoteUrl) return;

    try {
      await git.deleteRemote({ dir, remote: 'origin' });
      // Clear any errors when disconnecting
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['git-status', projectId] });
    } catch (err) {
      const message = err instanceof Error ? err : new Error('Failed to disconnect');
      setError(message);
    }
  };

  const getExternalUrl = useCallback(async (url: URL): Promise<string | null> => {
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.href;
    }

    if (url.protocol === 'nostr:') {
      const nostrUri = await NostrURI.parse(url.href);
      return ngitWebUrl({ template: config.ngitWebUrl, nostrURI: nostrUri });
    }

    return null;
  }, [config.ngitWebUrl]);

  const handleOpenExternal = async () => {
    if (!remoteUrl) return;

    try {
      const externalUrl = await getExternalUrl(remoteUrl);
      if (externalUrl) {
        window.open(externalUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('Failed to open external URL:', err);
    }
  };

  const getProviderInfo = useCallback(() => {
    if (!remoteUrl) return null;

    // Check if it's a Nostr URI
    if (remoteUrl.protocol === 'nostr:') {
      return {
        name: 'Nostr Git',
        icon: <Zap className="size-4" />,
        isNostr: true,
      };
    }

    // Check if we have a matched credential
    const matchedCredential = findCredentialsForRepo(remoteUrl, settings.credentials);

    return {
      name: matchedCredential? matchedCredential.name : remoteUrl.hostname,
      icon: <ExternalFavicon url={remoteUrl} size={16} />,
      isNostr: false,
    };
  }, [remoteUrl, settings.credentials]);

  const providerInfo = getProviderInfo();
  const remoteName = providerInfo?.name ?? 'the remote';

  // Extract repo identifier from Nostr URI if applicable
  const getRepoIdentifier = useCallback(async (): Promise<string | null> => {
    if (!remoteUrl || remoteUrl.protocol !== 'nostr:') {
      return null;
    }

    try {
      const nostrUri = await NostrURI.parse(remoteUrl.href);
      return nostrUri.identifier;
    } catch {
      return null;
    }
  }, [remoteUrl]);

  // Warm up the Nostr repo query if this is a Nostr URI
  // This prefetches the data so it's ready when the edit dialog opens
  useNostrRepo({
    repoIdentifier: repoIdentifier || '',
    enabled: !!repoIdentifier && remoteUrl?.protocol === 'nostr:',
  });

  // Extract and set repo identifier on mount if it's a Nostr URI
  useEffect(() => {
    if (remoteUrl?.protocol === 'nostr:') {
      getRepoIdentifier().then(id => {
        if (id) setRepoIdentifier(id);
      });
    }
  }, [remoteUrl, getRepoIdentifier]);

  // Get the button label based on current operation
  const getButtonLabel = (): string => {
    if (!isSyncing) return 'Sync';

    switch (currentOperation) {
      case 'fetch':
        return 'Fetching';
      case 'pull':
        return 'Pulling';
      case 'push':
        return 'Pushing';
      default:
        return 'Syncing';
    }
  };

  const handleEditRepo = () => {
    if (repoIdentifier) {
      setEditRepoOpen(true);
    }
  };

  const handleRepoEditSuccess = () => {
    // Refresh git status after successful edit
    queryClient.invalidateQueries({ queryKey: ['git-status', projectId] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {providerInfo?.icon}
          <h3 className="font-semibold">{providerInfo?.name}</h3>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <EllipsisVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {providerInfo?.isNostr && (
                <DropdownMenuItem onClick={handleEditRepo} className="gap-2">
                  <Edit className="h-4 w-4" />
                  Edit Repository
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setGitHistoryOpen(true)} className="gap-2">
                <History className="h-4 w-4" />
                Rollback
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDisconnect} className="text-destructive gap-2">
                <CloudOff className="h-4 w-4" />
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Repository URL</Label>
        <div className="flex gap-2">
          <Input
            value={remoteUrl.href}
            readOnly
            className="flex-1 text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyUrl}
            className="shrink-0 h-10"
          >
            {copiedUrl ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenExternal}
            className="shrink-0 h-10"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Switch
          id="autosync"
          checked={autosync}
          onCheckedChange={setAutosync}
          disabled={isLoadingAutosync}
          className="scale-75"
        />
        <Label htmlFor="autosync" className="text-xs cursor-pointer font-normal text-muted-foreground">
          Automatic sync
        </Label>
      </div>

      {error && (
        <SyncStepError
          error={error}
          onDismiss={() => setError(null)}
          onForcePull={() => setShowForcePullDialog(true)}
          onForcePush={() => setShowForcePushDialog(true)}
          onPull={handlePull}
          remoteName={remoteName}
          remoteUrl={remoteUrl}
        />
      )}

      {/* Unsynced changes notification */}
      {hasRemoteChanges && !error && (
        <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3">
          <p className="text-sm text-yellow-900 dark:text-yellow-100">
            This branch is{' '}
            {commitsAhead > 0 && (
              <>
                <span className="font-medium">{commitsAhead} commit{commitsAhead !== 1 ? 's' : ''} ahead of</span>
                {commitsBehind > 0 ? ' and ' : ' '}
              </>
            )}
            {commitsBehind > 0 && (
              <>
                <span className="font-medium">{commitsBehind} commit{commitsBehind !== 1 ? 's' : ''} behind</span>{' '}
              </>
            )}
            <span className="font-medium">{ref}</span> on {remoteName}.
          </p>
        </div>
      )}

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="space-y-2">
          <div className="rounded-md bg-primary relative">
            <div className="flex">
              <Button
                onClick={handleSync}
                disabled={isSyncing}
                className="flex-1 rounded-r-none bg-transparent hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {syncSuccess
                    ? <Check className="h-4 w-4" />
                    : <RefreshCw className={cn("size-4", { "animate-spin": isSyncing })} />}
                  <span>{getButtonLabel()}</span>
                </div>
              </Button>
              <div className="w-px bg-border/20" />
              <CollapsibleTrigger asChild>
                <Button className="px-3 rounded-l-none bg-transparent hover:bg-white/10 transition-colors">
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    { "rotate-180": isExpanded }
                  )} />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          <CollapsibleContent className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Button
                  onClick={handlePull}
                  variant="outline"
                  disabled={isSyncing}
                  className="w-full"
                >
                  {currentOperation === 'pull' ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowDown className="h-4 w-4" />
                  )}
                  Pull
                </Button>
              </div>
              <div className="relative flex-1">
                <Button
                  onClick={handlePush}
                  variant="outline"
                  disabled={isSyncing}
                  className="w-full"
                >
                  {currentOperation === 'push' ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                  Push
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <ForcePullDialog
        open={showForcePullDialog}
        onOpenChange={setShowForcePullDialog}
        onConfirm={handleForcePull}
        remoteName={remoteName}
      />

      <ForcePushDialog
        open={showForcePushDialog}
        onOpenChange={setShowForcePushDialog}
        onConfirm={handleForcePush}
        remoteName={remoteName}
      />

      <GitHistoryDialog
        projectId={projectId}
        open={gitHistoryOpen}
        onOpenChange={setGitHistoryOpen}
      />

      {repoIdentifier && (
        <NostrRepoEditDialog
          open={editRepoOpen}
          onOpenChange={setEditRepoOpen}
          repoIdentifier={repoIdentifier}
          onSuccess={handleRepoEditSuccess}
        />
      )}
    </div>
  );
}
