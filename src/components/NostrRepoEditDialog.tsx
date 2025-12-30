import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAppContext } from '@/hooks/useAppContext';
import { createRepositoryAnnouncementEvent } from '@/lib/announceRepository';
import { nip19 } from 'nostr-tools';

interface NostrRepoEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repoIdentifier: string;
  onSuccess?: () => void;
}

// Helper function to convert kebab-case to Title Case
function kebabToTitleCase(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function NostrRepoEditDialog({
  open,
  onOpenChange,
  repoIdentifier,
  onSuccess,
}: NostrRepoEditDialogProps) {
  const [repoName, setRepoName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { config } = useAppContext();

  // Load existing repository data with react-query
  const { data: existingEvent, isLoading } = useQuery({
    queryKey: ['nostr-repo', user?.pubkey, repoIdentifier],
    queryFn: async () => {
      if (!user) return null;

      const events = await nostr.query(
        [{ kinds: [30617], authors: [user.pubkey], '#d': [repoIdentifier], limit: 1 }],
        { signal: AbortSignal.timeout(5000) }
      );

      return events.length > 0 ? events[0] : null;
    },
    enabled: !!user && !!repoIdentifier,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Update form fields when event data loads
  useEffect(() => {
    if (existingEvent) {
      const name = existingEvent.tags.find(([tagName]) => tagName === 'name')?.[1] || kebabToTitleCase(repoIdentifier);
      const desc = existingEvent.tags.find(([tagName]) => tagName === 'description')?.[1] || '';

      setRepoName(name);
      setDescription(desc);
    } else if (!isLoading) {
      // No existing event, use defaults
      setRepoName(kebabToTitleCase(repoIdentifier));
      setDescription('');
    }
  }, [existingEvent, isLoading, repoIdentifier]);

  const handleSave = async () => {
    if (!user || !existingEvent) {
      setError('Repository not found');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Extract existing data from the event
      const webTag = existingEvent.tags.find(([tagName]) => tagName === 'web');
      const webUrls = webTag ? webTag.slice(1) : undefined;
      const tTags = existingEvent.tags
        .filter(([tagName]) => tagName === 't')
        .map(([, value]) => value);
      const eucTag = existingEvent.tags.find(([tagName, , marker]) => tagName === 'r' && marker === 'euc');
      const earliestCommit = eucTag?.[1];

      // Get clone URLs and relays from existing event
      const cloneTag = existingEvent.tags.find(([tagName]) => tagName === 'clone');
      const cloneUrls = cloneTag ? cloneTag.slice(1) : [];
      const relaysTag = existingEvent.tags.find(([tagName]) => tagName === 'relays');
      const relays = relaysTag ? relaysTag.slice(1) : [];

      // If no clone URLs or relays, regenerate from current GRASP servers
      let finalCloneUrls = cloneUrls;
      let finalRelays = relays;

      if (cloneUrls.length === 0 || relays.length === 0) {
        // Convert user's GRASP servers to clone URLs and relay URLs
        const npub = nip19.npubEncode(user.pubkey);
        const newCloneUrls = new Set<string>();
        const newRelays = new Set<string>();

        for (const graspRelay of config.graspMetadata.relays) {
          try {
            const relayUrl = new URL(graspRelay.url);
            newRelays.add(relayUrl.href);

            const cloneUrl = new URL(`/${npub}/${repoIdentifier}.git`, `https://${relayUrl.host}`);
            newCloneUrls.add(cloneUrl.href);
          } catch {
            // fallthrough
          }
        }

        for (const relay of config.relayMetadata.relays.filter(r => r.write)) {
          try {
            const relayUrl = new URL(relay.url);
            newRelays.add(relayUrl.href);
          } catch {
            // fallthrough
          }
        }

        finalCloneUrls = cloneUrls.length === 0 ? [...newCloneUrls] : cloneUrls;
        finalRelays = relays.length === 0 ? [...newRelays] : relays;
      }

      // Create updated repository announcement event
      const eventTemplate = createRepositoryAnnouncementEvent({
        repoId: repoIdentifier,
        name: repoName.trim() || undefined,
        description: description.trim() || undefined,
        webUrls,
        cloneUrls: finalCloneUrls,
        relays: finalRelays,
        tTags: tTags.length > 0 ? tTags : undefined,
        earliestCommit,
      });

      // Publish the updated event
      await publishEvent(eventTemplate);

      // Wait a moment for relays to process
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }

      // Close dialog
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update repository';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRepoNameChange = (value: string) => {
    setRepoName(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Repository</DialogTitle>
          <DialogDescription>
            Update your repository announcement on Nostr.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-24 w-full" />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="repo-name">Repo Name</Label>
                <Input
                  id="repo-name"
                  placeholder="My Project"
                  value={repoName}
                  onChange={(e) => handleRepoNameChange(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="A brief description of your project"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving || isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading || !existingEvent}
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
