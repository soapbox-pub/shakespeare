import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useGit } from '@/hooks/useGit';
import { useGitStatus } from '@/hooks/useGitStatus';
import { useFSPaths } from '@/hooks/useFSPaths';
import { useNostr } from '@nostrify/react';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useFS } from '@/hooks/useFS';
import { useAppContext } from '@/hooks/useAppContext';
import { Link } from 'react-router-dom';
import { createRepositoryAnnouncementEvent } from '@/lib/announceRepository';
import { DotAI } from '@/lib/DotAI';
import { nip19 } from 'nostr-tools';
import type { ConfigureRepoStepProps } from '../types';
import type { NostrEvent } from '@nostrify/nostrify';
import { NostrURI } from '@/lib/NostrURI';

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
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { fs } = useFS();
  const { config } = useAppContext();

  const handlePushInitial = async () => {
    setIsPushing(true);
    setError(null);

    try {
      const dir = `${projectsPath}/${projectId}`;

      if (selectedProvider.id === 'nostr') {
        if (!user) {
          throw new Error('User is not logged in');
        }

        // Check if a NIP-34 repo announcement already exists for this project
        const existingRepos = await nostr.query(
          [{ kinds: [30617], authors: [user.pubkey], '#d': [projectId], limit: 1 }],
          { signal: AbortSignal.timeout(5000) }
        );

        let repoEvent: NostrEvent;

        if (existingRepos.length > 0) {
          // Use existing repo announcement as template and update with current GRASP servers
          const existingEvent = existingRepos[0];

          // Convert user's GRASP servers to clone URLs and relay URLs
          const npub = nip19.npubEncode(user.pubkey);
          const cloneUrls = new Set<string>();
          const relays = new Set<string>();

          for (const graspRelay of config.graspMetadata.relays) {
            try {
              const relayUrl = new URL(graspRelay.url);
              relays.add(relayUrl.href);

              const cloneUrl = new URL(`/${npub}/${projectId}.git`, `https://${relayUrl.host}`);

              cloneUrls.add(cloneUrl.href);
            } catch (err) {
              console.warn(`Failed to parse Nostr git relay URL: ${graspRelay.url}`, err);
            }
          }

          // Validate that we have at least one clone URL and relay
          if (cloneUrls.size === 0 || relays.size === 0) {
            throw new Error('No Nostr git servers configured. Please configure Nostr git servers in Settings > Nostr.');
          }

          // Extract existing data from the event
          const name = existingEvent.tags.find(([tagName]) => tagName === 'name')?.[1];
          const description = existingEvent.tags.find(([tagName]) => tagName === 'description')?.[1];
          const webTag = existingEvent.tags.find(([tagName]) => tagName === 'web');
          const webUrls = webTag ? webTag.slice(1) : undefined;
          const tTags = existingEvent.tags
            .filter(([tagName]) => tagName === 't')
            .map(([, value]) => value);
          const eucTag = existingEvent.tags.find(([tagName, , marker]) => tagName === 'r' && marker === 'euc');
          const earliestCommit = eucTag?.[1];

          // Create updated repository announcement event with new clone URLs and relays
          const eventTemplate = createRepositoryAnnouncementEvent({
            repoId: projectId,
            name,
            description,
            webUrls,
            cloneUrls: [...cloneUrls],
            relays: [...relays],
            tTags: tTags.length > 0 ? tTags : undefined,
            earliestCommit,
          });

          // Publish the updated event
          repoEvent = await publishEvent(eventTemplate);

          // Wait 5 seconds for Nostr git servers to update
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          // Create and publish new NIP-34 repository announcement

          // Get the template name
          const dotAI = new DotAI(fs, `${projectsPath}/${projectId}`);
          const template = await dotAI.readTemplate();

          // Build t-tags array
          const tTags = ['shakespeare'];

          if (template) {
            tTags.push(template.name);
          }

          // Convert user's GRASP servers to clone URLs and relay URLs
          const npub = nip19.npubEncode(user.pubkey);
          const cloneUrls = new Set<string>();
          const relays = new Set<string>();

          for (const graspRelay of config.graspMetadata.relays) {
            try {
              const relayUrl = new URL(graspRelay.url);
              relays.add(relayUrl.href);

              const cloneUrl = new URL(`/${npub}/${projectId}.git`, `https://${relayUrl.host}`);

              cloneUrls.add(cloneUrl.href);
            } catch (err) {
              console.warn(`Failed to parse Nostr git relay URL: ${graspRelay.url}`, err);
            }
          }

          // Validate that we have at least one clone URL and relay
          if (cloneUrls.size === 0 || relays.size === 0) {
            throw new Error('No Nostr git servers configured. Please configure Nostr git servers in Settings > Nostr.');
          }

          // Create the repository announcement event
          const eventTemplate = createRepositoryAnnouncementEvent({
            repoId: projectId,
            name: projectId,
            cloneUrls: [...cloneUrls],
            relays: [...relays],
            tTags,
          });

          // Publish the event
          repoEvent = await publishEvent(eventTemplate);

          // Wait 5 seconds for Nostr git servers to update
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

        // Construct Nostr URI
        const nostrURI = new NostrURI({ pubkey: repoEvent.pubkey, identifier: projectId });

        // Configure the Nostr URI as the origin
        await git.addRemote({
          dir,
          remote: 'origin',
          url: nostrURI.toString(),
          force: true,
        });

        // Push to Nostr (the rest of the Nostr logic is handled internally by git.push)
        await git.push({
          dir,
          remote: 'origin',
          ref: gitStatus?.currentBranch || 'main',
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
          Push your code to Nostr with one click. Your repository will be stored on public Nostr git <Link className="underline" to="/settings/nostr">servers</Link>.
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
          First create the repository on {selectedProvider.origin ? <a href={selectedProvider.origin} className="underline" target="_blank">{selectedProvider.name}</a> : selectedProvider.name}, then paste the URL here.
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
