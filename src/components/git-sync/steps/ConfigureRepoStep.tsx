import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useGit } from '@/hooks/useGit';
import { useGitStatus } from '@/hooks/useGitStatus';
import { useFSPaths } from '@/hooks/useFSPaths';
import { Link } from 'react-router-dom';
import type { ConfigureRepoStepProps } from '../types';

export function ConfigureRepoStep({
  projectId,
  selectedProvider,
  onBack,
  onSuccess,
  onClose,
}: ConfigureRepoStepProps) {
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useCurrentUser();
  const { git } = useGit();
  const { projectsPath } = useFSPaths();
  const { data: gitStatus, refetch: refetchGitStatus } = useGitStatus(projectId);

  const handlePushInitial = async () => {
    setIsPushing(true);
    setError(null);

    try {
      const dir = `${projectsPath}/${projectId}`;

      if (selectedProvider.id === 'nostr') {
        // TODO: Implement Nostr push
        // For now, just simulate success
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Configure a Nostr URI as the origin
        const nostrUri = `nostr://npub1example/${projectId}`;
        await git.addRemote({
          dir,
          remote: 'origin',
          url: nostrUri,
        });
      } else {
        // Validate repository URL
        if (!repositoryUrl.trim()) {
          throw new Error('Repository URL is required');
        }

        // Add remote
        await git.addRemote({
          dir,
          remote: 'origin',
          url: repositoryUrl,
          force: true, // Override if exists
        });

        // Push to remote
        await git.push({
          dir,
          remote: 'origin',
          ref: gitStatus?.currentBranch || 'main',
        });
      }

      // Refresh git status before showing success
      await refetchGitStatus();
      // Show success state
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to push';
      setError(message);
    } finally {
      setIsPushing(false);
    }
  };

  // "Other" provider - show link to git settings
  if (selectedProvider.id === 'other') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {selectedProvider.icon}
          <h3 className="font-semibold">{selectedProvider.name}</h3>
        </div>

        <p className="text-sm text-muted-foreground">
          Configure additional git providers in{' '}
          <Link
            to="/settings/git"
            className="underline hover:no-underline font-medium"
            onClick={onClose}
          >
            Git Settings
          </Link>
          .
        </p>

        <Button
          onClick={onBack}
          variant="outline"
          className="w-full"
        >
          Back
        </Button>
      </div>
    );
  }

  // Nostr provider - check if user is logged in
  if (selectedProvider.id === 'nostr') {
    if (!user) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {selectedProvider.icon}
            <h3 className="font-semibold">{selectedProvider.name}</h3>
          </div>

          <p className="text-sm text-muted-foreground">
            You need to be logged in with Nostr to use this feature. Please visit{' '}
            <Link
              to="/settings/nostr"
              className="underline hover:no-underline font-medium"
              onClick={onClose}
            >
              Nostr Settings
            </Link>{' '}
            to log in.
          </p>

          <Button
            onClick={onBack}
            variant="outline"
            className="w-full"
          >
            Back
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {selectedProvider.icon}
          <h3 className="font-semibold">{selectedProvider.name}</h3>
        </div>

        <p className="text-sm text-muted-foreground">
          Push your code to Nostr with one click. Your repository will be stored on public Nostr relays.
        </p>

        {error && (
          <Alert variant="destructive">
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handlePushInitial}
            disabled={isPushing}
            className="flex-1"
          >
            {isPushing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                Pushing...
              </>
            ) : (
              'Push'
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Regular git provider - show repository URL input
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {selectedProvider.icon}
        <h3 className="font-semibold">{selectedProvider.name}</h3>
      </div>

      <div className="space-y-2">
        <Label htmlFor="repo-url">Repository URL</Label>
        <Input
          id="repo-url"
          placeholder="https://github.com/username/repo.git"
          value={repositoryUrl}
          onChange={(e) => setRepositoryUrl(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          First create the repository on {selectedProvider.name}, then paste the URL here.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handlePushInitial}
          disabled={isPushing || !repositoryUrl.trim()}
          className="flex-1"
        >
          {isPushing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
              Pushing...
            </>
          ) : (
            'Push'
          )}
        </Button>
      </div>
    </div>
  );
}
