import { useState, useCallback } from 'react';
import { Zap, Copy, Check, RefreshCw, EllipsisVertical, CloudOff, ExternalLink, ChevronDown, ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExternalFavicon } from '@/components/ExternalFavicon';
import { SyncStepError } from './SyncStepError';
import { ForcePullDialog } from './ForcePullDialog';
import { useGitStatus } from '@/hooks/useGitStatus';
import { useGitSettings } from '@/hooks/useGitSettings';
import { useGit } from '@/hooks/useGit';
import { useFSPaths } from '@/hooks/useFSPaths';
import { useAppContext } from '@/hooks/useAppContext';
import type { StepProps } from '../types';
import { cn } from '@/lib/utils';
import { NostrURI } from '@/lib/NostrURI';
import { ngitWebUrl } from '@/lib/ngitWebUrl';
import { useQueryClient } from '@tanstack/react-query';

type GitOperation = 'sync' | 'pull' | 'push' | 'force-pull';

export function SyncStep({ projectId }: StepProps) {
  const queryClient = useQueryClient();

  const [isSyncing, setIsSyncing] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<GitOperation | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showForcePullDialog, setShowForcePullDialog] = useState(false);

  const { data: gitStatus } = useGitStatus(projectId);
  const { settings } = useGitSettings();
  const { git } = useGit();
  const { projectsPath } = useFSPaths();
  const { config } = useAppContext();

  const originRemote = gitStatus?.remotes.find(r => r.name === 'origin');

  // Match origin URL to a credential
  const matchedCredential = originRemote
    ? settings.credentials.find(c => originRemote.url.startsWith(c.origin))
    : null;

  const dir = `${projectsPath}/${projectId}`;
  const ref = gitStatus?.currentBranch || 'main';

  // Generic git operation handler
  const executeGitOperation = useCallback(async (
    operation: GitOperation,
    action: () => Promise<void>
  ) => {
    if (!originRemote) return;

    setIsSyncing(true);
    setDropdownOpen(false);
    setCurrentOperation(operation);
    setError(null);
    setSyncSuccess(false);

    try {
      await action();

      // Show success feedback
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 1500);
    } catch (err) {
      const message = err instanceof Error ? err : new Error(`Failed to ${operation}`);
      setError(message);
    } finally {
      setIsSyncing(false);
      setCurrentOperation(null);
    }
  }, [originRemote]);

  const handleSync = async () => {
    await executeGitOperation('sync', async () => {
      // Pull first to get latest changes
      await git.pull({ dir, ref, singleBranch: true });
      // Then push local changes
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

  // Temporary feedback state helper
  const showTemporaryFeedback = useCallback((
    setter: (value: boolean) => void,
    duration: number
  ) => {
    setter(true);
    setTimeout(() => setter(false), duration);
  }, []);

  const handleCopyUrl = async () => {
    if (!originRemote) return;

    try {
      await navigator.clipboard.writeText(originRemote.url);
      showTemporaryFeedback(setCopiedUrl, 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleDisconnect = async () => {
    if (!originRemote) return;

    try {
      await git.deleteRemote({ dir, remote: 'origin' });
      queryClient.invalidateQueries({ queryKey: ['git-status', projectId] });
    } catch (err) {
      const message = err instanceof Error ? err : new Error('Failed to disconnect');
      setError(message);
    }
  };

  const getExternalUrl = useCallback(async (url: string): Promise<string | null> => {
    if (url.startsWith('https://')) {
      return url;
    }

    if (url.startsWith('nostr://')) {
      const nostrUri = await NostrURI.parse(url);
      return ngitWebUrl(config.ngitWebUrl, nostrUri);
    }

    return null;
  }, [config.ngitWebUrl]);

  const handleOpenExternal = async () => {
    if (!originRemote) return;

    try {
      const externalUrl = await getExternalUrl(originRemote.url);
      if (externalUrl) {
        window.open(externalUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('Failed to open external URL:', err);
    }
  };

  const getProviderInfo = useCallback(() => {
    if (!originRemote) return null;

    let url: URL | null;
    try {
      url = new URL(originRemote.url);
    } catch {
      url = null;
    }

    // Check if it's a Nostr URI
    if (originRemote.url.startsWith('nostr://')) {
      return {
        name: 'Nostr Git',
        icon: <Zap className="size-4" />,
      };
    }

    // Check if we have a matched credential
    if (matchedCredential) {
      return {
        name: matchedCredential.name,
        icon: (
          <ExternalFavicon
            url={matchedCredential.origin}
            size={16}
          />
        ),
      };
    }

    // Fallback to generic Git
    return {
      name: url?.hostname || 'Git',
    };
  }, [originRemote, matchedCredential]);

  const providerInfo = getProviderInfo();

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
      case 'sync':
        return 'Sync';
      default:
        return 'Sync';
    }
  };

  if (!originRemote) {
    return null;
  }

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
              <DropdownMenuItem onClick={handleDisconnect} className="text-destructive">
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
            value={originRemote.url}
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
          onPull={handlePull}
        />
      )}

      <div className="rounded-md bg-primary">
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
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                disabled={isSyncing}
                className="px-3 rounded-l-none bg-transparent hover:bg-white/10 transition-colors"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="flex gap-2 p-2">
                <Button
                  onClick={handlePush}
                  variant="outline"
                  className="flex-1"
                >
                  <ArrowUp className="h-4 w-4" />
                  Push
                </Button>
                <Button
                  onClick={handlePull}
                  variant="outline"
                  className="flex-1"
                >
                  <ArrowDown className="h-4 w-4" />
                  Pull
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ForcePullDialog
        open={showForcePullDialog}
        onOpenChange={setShowForcePullDialog}
        onConfirm={handleForcePull}
      />
    </div>
  );
}
