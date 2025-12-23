import { useState } from 'react';
import { Zap, GitBranch, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalFavicon } from '@/components/ExternalFavicon';
import { useGitStatus } from '@/hooks/useGitStatus';
import { useGitSettings } from '@/hooks/useGitSettings';
import { useGit } from '@/hooks/useGit';
import { useFSPaths } from '@/hooks/useFSPaths';
import type { StepProps } from '../types';

export function SyncStep({ projectId }: StepProps) {
  const [isPushing, setIsPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const { data: gitStatus } = useGitStatus(projectId);
  const { settings } = useGitSettings();
  const { git } = useGit();
  const { projectsPath } = useFSPaths();

  const originRemote = gitStatus?.remotes.find(r => r.name === 'origin');

  // Match origin URL to a credential
  const matchedCredential = originRemote
    ? settings.credentials.find(c => originRemote.url.startsWith(c.origin))
    : null;

  const handlePull = async () => {
    if (!originRemote) return;

    setIsPushing(true);
    setError(null);

    try {
      const dir = `${projectsPath}/${projectId}`;

      await git.pull({
        dir,
        ref: gitStatus?.currentBranch || 'main',
        singleBranch: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to pull';
      setError(message);
    } finally {
      setIsPushing(false);
    }
  };

  const handlePush = async () => {
    if (!originRemote) return;

    setIsPushing(true);
    setError(null);

    try {
      const dir = `${projectsPath}/${projectId}`;

      await git.push({
        dir,
        remote: 'origin',
        ref: gitStatus?.currentBranch || 'main',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to push';
      setError(message);
    } finally {
      setIsPushing(false);
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
      <div className="flex items-center gap-2">
        {providerInfo?.icon}
        <h3 className="font-semibold">{providerInfo?.name}</h3>
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

      <div className="flex gap-2">
        <Button
          onClick={handlePull}
          disabled={isPushing}
          className="flex-1"
          variant="outline"
        >
          {isPushing ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
          ) : (
            'Pull'
          )}
        </Button>
        <Button
          onClick={handlePush}
          disabled={isPushing}
          className="flex-1"
        >
          {isPushing ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
          ) : (
            'Push'
          )}
        </Button>
      </div>
    </div>
  );
}
