import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useGitAutosync } from '@/hooks/useGitAutosync';
import { ArrowUp } from 'lucide-react';
import { ForcePushDialog } from './ForcePushDialog';
import { SyncStepError } from './SyncStepError';
import { useProjectDeploySettings } from '@/hooks/useProjectDeploySettings';

// Helper function to convert kebab-case to Title Case
function kebabToTitleCase(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function ConfigureRepoStep({
  projectId,
  selectedProvider,
  onBack,
  onSuccess,
  onClose,
}: ConfigureRepoStepProps) {
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [repoIdentifier, setRepoIdentifier] = useState(projectId);
  const [repoName, setRepoName] = useState(kebabToTitleCase(projectId));
  const [isRepoNameManuallyEdited, setIsRepoNameManuallyEdited] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [showForcePushDialog, setShowForcePushDialog] = useState(false);

  const { user } = useCurrentUser();
  const { git } = useGit();
  const { projectsPath } = useFSPaths();

  const dir = `${projectsPath}/${projectId}`;

  const { data: gitStatus, refetch: refetchGitStatus } = useGitStatus(projectId);
  const { refetch: refetchAutosync } = useGitAutosync(dir);
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { fs } = useFS();
  const { config } = useAppContext();
  const { settings: projectDeploySettings } = useProjectDeploySettings(projectId);

  // Auto-update repo name when repo identifier changes (unless manually edited)
  useEffect(() => {
    if (!isRepoNameManuallyEdited) {
      setRepoName(kebabToTitleCase(repoIdentifier));
    }
  }, [repoIdentifier, isRepoNameManuallyEdited]);

  // Handler for repo identifier changes
  const handleRepoIdentifierChange = (value: string) => {
    setRepoIdentifier(value);
  };

  // Handler for repo name changes
  const handleRepoNameChange = (value: string) => {
    setRepoName(value);
    setIsRepoNameManuallyEdited(true);
  };

  // Shared push logic for both initial push and force push
  const executePush = async (force: boolean = false) => {
    // Store the URL we're trying to add so we can remove it on error
    let remoteAdded = false;

    try {
      if (selectedProvider.id === 'nostr') {
        if (!user) {
          throw new Error('User is not logged in');
        }

        // Check if a NIP-34 repo announcement already exists for this project
        const existingRepos = await nostr.query(
          [{ kinds: [30617], authors: [user.pubkey], '#d': [repoIdentifier], limit: 1 }],
          { signal: AbortSignal.timeout(5000) }
        );

        // Convert user's GRASP servers to clone URLs and relay URLs
        const npub = nip19.npubEncode(user.pubkey);
        const cloneUrls = new Set<string>();
        const relays = new Set<string>();

        for (const graspRelay of config.graspMetadata.relays) {
          try {
            const relayUrl = new URL(graspRelay.url);
            relays.add(relayUrl.href);

            const cloneUrl = new URL(`/${npub}/${repoIdentifier}.git`, `https://${relayUrl.host}`);

            cloneUrls.add(cloneUrl.href);
          } catch {
            // fallthrough
          }
        }

        for (const relay of config.relayMetadata.relays.filter(r => r.write)) {
          try {
            const relayUrl = new URL(relay.url);
            relays.add(relayUrl.href);
          } catch {
            // fallthrough
          }
        }

        // Validate that we have at least one clone URL and relay
        if (cloneUrls.size === 0 || relays.size === 0) {
          throw new Error('No Nostr git servers configured. Please configure Nostr git servers in Settings > Nostr.');
        }

        let repoEvent: NostrEvent;

        if (existingRepos.length > 0) {
          // Use existing repo announcement as template and update with current GRASP servers
          const existingEvent = existingRepos[0];

          // Extract existing data from the event
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
            repoId: repoIdentifier,
            name: repoName,
            description,
            webUrls,
            cloneUrls: [...cloneUrls].slice(0, 10), // Limit to first 10 clone URLs
            relays: [...relays].slice(0, 10), // Limit to first 10 relays
            tTags: tTags.length > 0 ? tTags : undefined,
            earliestCommit,
          });

          // Publish the updated event
          repoEvent = await publishEvent(eventTemplate);
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

          // Get deployment URL from project settings if available
          let webUrls: string[] | undefined;
          if (projectDeploySettings.currentProvider) {
            const currentProviderConfig = projectDeploySettings.providers[projectDeploySettings.currentProvider];
            if (currentProviderConfig?.url) {
              webUrls = [currentProviderConfig.url];
            }
          }

          // Create the repository announcement event
          const eventTemplate = createRepositoryAnnouncementEvent({
            repoId: repoIdentifier,
            name: repoName,
            cloneUrls: [...cloneUrls],
            relays: [...relays],
            tTags,
            webUrls,
          });

          // Publish the event
          repoEvent = await publishEvent(eventTemplate);
        }

        // Wait 5 seconds for Nostr git servers to update
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Construct Nostr URI
        const nostrURI = new NostrURI({
          pubkey: repoEvent.pubkey,
          identifier: repoIdentifier,
          relay: [...relays][0],
        });

        // Configure the Nostr URI as the origin
        await git.addRemote({
          dir,
          remote: 'origin',
          url: nostrURI.toString(),
          force: true,
        });
        remoteAdded = true;

        // Push to Nostr (the rest of the Nostr logic is handled internally by git.push)
        await git.push({
          dir,
          remote: 'origin',
          ref: gitStatus?.currentBranch || 'main',
          force,
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
        remoteAdded = true;

        // Push to remote
        await git.push({
          dir,
          remote: 'origin',
          ref: gitStatus?.currentBranch || 'main',
          force,
        });
      }

      // Enable autosync by default after successfully setting up the remote
      await git.setConfig({
        dir,
        path: 'shakespeare.autosync',
        value: 'true',
      });

      // Refresh git status before showing success
      await refetchAutosync();
      await refetchGitStatus();
      // Show success state
      onSuccess();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(force ? 'Failed to force push' : 'Failed to push');
      
      // If we added the remote but push failed, remove it
      if (remoteAdded) {
        try {
          await git.deleteRemote({ dir, remote: 'origin' });
        } catch {
          // Ignore errors when cleaning up remote
        }
      }
      
      throw error; // Re-throw so caller can handle
    }
  };

  const handlePushInitial = async () => {
    setIsPushing(true);
    setError(null);

    try {
      await executePush(false);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to push');
      setError(error);
    } finally {
      setIsPushing(false);
    }
  };

  const handleForcePush = async () => {
    setIsPushing(true);
    setError(null);
    setShowForcePushDialog(false);

    try {
      await executePush(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to force push');
      setError(error);
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

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label htmlFor="repo-identifier">Repo Identifier <span className="text-destructive">*</span></Label>
            <Input
              id="repo-identifier"
              placeholder="my-project"
              value={repoIdentifier}
              onChange={(e) => handleRepoIdentifierChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="repo-name">Repo Name</Label>
            <Input
              id="repo-name"
              placeholder="My Project"
              value={repoName}
              onChange={(e) => handleRepoNameChange(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <SyncStepError
            error={error}
            onDismiss={() => setError(null)}
            onForcePush={() => setShowForcePushDialog(true)}
            remoteName={selectedProvider.name}
            context="configure"
          />
        )}

        <div className="flex gap-2">
          <Button
            onClick={handlePushInitial}
            disabled={isPushing}
            className="flex-1"
          >
            {isPushing
              ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
              : <ArrowUp className="h-4 w-4" />}
            {isPushing ? 'Pushing...' : 'Push'}
          </Button>
        </div>

        <ForcePushDialog
          open={showForcePushDialog}
          onOpenChange={setShowForcePushDialog}
          onConfirm={handleForcePush}
          remoteName={selectedProvider.name}
        />
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
        <SyncStepError
          error={error}
          onDismiss={() => setError(null)}
          onForcePush={() => setShowForcePushDialog(true)}
          remoteName={selectedProvider.name}
          context="configure"
        />
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

      <ForcePushDialog
        open={showForcePushDialog}
        onOpenChange={setShowForcePushDialog}
        onConfirm={handleForcePush}
        remoteName={selectedProvider.name}
      />
    </div>
  );
}
