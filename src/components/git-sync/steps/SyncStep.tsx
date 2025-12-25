import { useState, useCallback } from 'react';
import { Zap, Copy, Check, RefreshCw, EllipsisVertical, CloudOff, ExternalLink, ChevronDown, ArrowDown, ArrowUp, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useGitStatus } from '@/hooks/useGitStatus';
import { useGitSettings } from '@/hooks/useGitSettings';
import { useGit } from '@/hooks/useGit';
import { useFSPaths } from '@/hooks/useFSPaths';
import { useAppContext } from '@/hooks/useAppContext';
import type { SyncStepProps } from '../types';
import { cn } from '@/lib/utils';
import { NostrURI } from '@/lib/NostrURI';
import { ngitWebUrl } from '@/lib/ngitWebUrl';
import { useQueryClient } from '@tanstack/react-query';
import { findCredentialsForRepo } from '@/lib/gitCredentials';

type GitOperation = 'sync' | 'pull' | 'push' | 'force-pull' | 'force-push';

export function SyncStep({ projectId, remoteUrl }: SyncStepProps) {
  const queryClient = useQueryClient();

  const [isSyncing, setIsSyncing] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<GitOperation | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showForcePullDialog, setShowForcePullDialog] = useState(false);
  const [showForcePushDialog, setShowForcePushDialog] = useState(false);

  const { data: gitStatus } = useGitStatus(projectId);
  const { settings } = useGitSettings();
  const { git } = useGit();
  const { projectsPath } = useFSPaths();
  const { config } = useAppContext();

  const dir = `${projectsPath}/${projectId}`;
  const ref = gitStatus?.currentBranch || 'main';

  const hasRemoteChanges = gitStatus?.remoteBranchExists && ((gitStatus?.ahead ?? 0) > 0 || (gitStatus?.behind ?? 0) > 0);
  const commitsAhead = gitStatus?.ahead ?? 0;
  const commitsBehind = gitStatus?.behind ?? 0;

  // Generic git operation handler
  const executeGitOperation = useCallback(async (
    operation: GitOperation,
    action: () => Promise<void>
  ) => {
    if (!remoteUrl) return;

    setIsSyncing(true);
    setCurrentOperation(operation);
    setError(null);
    setSyncSuccess(false);

    try {
      await action();

      // Show success feedback
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 2500);
    } catch (err) {
      const message = err instanceof Error ? err : new Error(`Failed to ${operation}`);
      setError(message);
    } finally {
      setIsSyncing(false);
      setCurrentOperation(null);
    }
  }, [remoteUrl]);

  const handleSync = async () => {
    await executeGitOperation('sync', async () => {
      // Pull first to get latest changes
      setCurrentOperation('pull');
      await git.pull({ dir, ref, singleBranch: true });
      // Then push local changes
      setCurrentOperation('push');
      await git.push({ dir, remote: 'origin', ref });
    });
  };

  const handlePull = async () => {
    await executeGitOperation('pull', async () => {
      await git.pull({ dir, ref, singleBranch: true });
    });
  };

  const handlePush = async () => {
    await executeGitOperation('push', async () => {
      await git.push({ dir, remote: 'origin', ref });
    });
  };

  const handleForcePull = async () => {
    await executeGitOperation('force-pull', async () => {
      // Step 1: Fetch latest changes from remote
      await git.fetch({
        dir,
        remote: 'origin',
        ref,
        singleBranch: true,
      });

      // Step 2: Get the remote commit SHA
      const remoteRef = `refs/remotes/origin/${ref}`;
      const remoteSha = await git.resolveRef({ dir, ref: remoteRef });

      // Step 3: Force update the current branch to point to remote
      await git.writeRef({
        dir,
        ref: `refs/heads/${ref}`,
        value: remoteSha,
        force: true,
      });

      // Step 4: Force checkout all files (overwrite local changes)
      await git.checkout({
        dir,
        ref,
        force: true,
      });

      // Invalidate git status to refresh UI
      queryClient.invalidateQueries({ queryKey: ['git-status', projectId] });
    });
  };

  const handleForcePush = async () => {
    await executeGitOperation('force-push', async () => {
      await git.push({ dir, remote: 'origin', ref, force: true });
    });
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
      return ngitWebUrl(config.ngitWebUrl, nostrUri);
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
      };
    }

    // Check if we have a matched credential
    const matchedCredential = findCredentialsForRepo(remoteUrl, settings.credentials);

    return {
      name: matchedCredential? matchedCredential.name : remoteUrl.hostname,
      icon: <ExternalFavicon url={remoteUrl} size={16} />,
    };
  }, [remoteUrl, settings.credentials]);

  const providerInfo = getProviderInfo();
  const remoteName = providerInfo?.name ?? 'the remote';

  // Get the button label based on current operation
  const getButtonLabel = (): string => {
    if (!isSyncing) return 'Sync';

    switch (currentOperation) {
      case 'pull':
        return 'Pull';
      case 'push':
        return 'Push';
      case 'force-pull':
        return 'Force Pull';
      case 'force-push':
        return 'Force Push';
      case 'sync':
        return 'Sync';
      default:
        return 'Sync';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {providerInfo?.icon}
          <h3 className="font-semibold">{providerInfo?.name}</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleOpenExternal}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <EllipsisVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
        </div>
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
              <Button
                onClick={handlePull}
                variant="outline"
                disabled={isSyncing}
                className="flex-1"
              >
                {currentOperation === 'pull' || currentOperation === 'force-pull' ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
                Pull
              </Button>
              <Button
                onClick={handlePush}
                variant="outline"
                disabled={isSyncing}
                className="flex-1"
              >
                {currentOperation === 'push' || currentOperation === 'force-push' ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
                Push
              </Button>
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
    </div>
  );
}
