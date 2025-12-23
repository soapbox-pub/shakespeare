import { useState } from 'react';
import { Zap, GitBranch, Copy, Check, RefreshCw, EllipsisVertical, CloudOff, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExternalFavicon } from '@/components/ExternalFavicon';
import { useGitStatus } from '@/hooks/useGitStatus';
import { useGitSettings } from '@/hooks/useGitSettings';
import { useGit } from '@/hooks/useGit';
import { useFSPaths } from '@/hooks/useFSPaths';
import type { StepProps } from '../types';
import { cn } from '@/lib/utils';
import { NostrURI } from '@/lib/NostrURI';

export function SyncStep({ projectId }: StepProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const { data: gitStatus } = useGitStatus(projectId);
  const { settings } = useGitSettings();
  const { git } = useGit();
  const { projectsPath } = useFSPaths();

  const originRemote = gitStatus?.remotes.find(r => r.name === 'origin');

  // Match origin URL to a credential
  const matchedCredential = originRemote
    ? settings.credentials.find(c => originRemote.url.startsWith(c.origin))
    : null;

  const handleSync = async () => {
    if (!originRemote) return;

    setIsSyncing(true);
    setError(null);
    setSyncSuccess(false);

    try {
      const dir = `${projectsPath}/${projectId}`;

      // Pull first to get latest changes
      await git.pull({
        dir,
        ref: gitStatus?.currentBranch || 'main',
        singleBranch: true,
      });

      // Then push local changes
      await git.push({
        dir,
        remote: 'origin',
        ref: gitStatus?.currentBranch || 'main',
      });

      // Show success feedback
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync';
      setError(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!originRemote) return;

    try {
      await navigator.clipboard.writeText(originRemote.url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleDisconnect = async () => {
    if (!originRemote) return;

    try {
      const dir = `${projectsPath}/${projectId}`;
      await git.deleteRemote({
        dir,
        remote: 'origin',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect';
      setError(message);
    }
  };

  const handleOpenExternal = async () => {
    if (!originRemote) return;

    try {
      let externalUrl: string;

      if (originRemote.url.startsWith('https://')) {
        // For HTTPS URLs, open directly
        externalUrl = originRemote.url;
      } else if (originRemote.url.startsWith('nostr://')) {
        // For Nostr URLs, parse and convert to naddr, then link to nostrhub.io
        const nostrUri = await NostrURI.parse(originRemote.url);
        const naddr = nostrUri.toNaddr();
        externalUrl = `https://nostrhub.io/${naddr}`;
      } else {
        // Unsupported URL type
        return;
      }

      window.open(externalUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Failed to open external URL:', err);
    }
  };

  const getProviderInfo = () => {
    if (!originRemote) return null;

    // Check if it's a Nostr URI
    if (originRemote.url.startsWith('nostr://')) {
      return {
        name: 'Nostr Git',
        icon: <Zap className="h-4 w-4" />,
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
            fallback={<GitBranch className="h-4 w-4" />}
          />
        ),
      };
    }

    // Fallback to generic Git
    return {
      name: 'Git',
      icon: <GitBranch className="h-4 w-4" />,
    };
  };

  const providerInfo = getProviderInfo();

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
                <CloudOff className="h-4 w-4 mr-2" />
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
        <Alert variant="destructive">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      <Button
        onClick={handleSync}
        disabled={isSyncing}
        className="w-full"
      >
        <div className="flex items-center gap-2">
          {syncSuccess
            ? <Check className="h-4 w-4" />
            : <RefreshCw className={cn("size-4", { "animate-spin": isSyncing })} />}
          <span>Sync</span>
        </div>
      </Button>
    </div>
  );
}
