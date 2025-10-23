import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  GitBranch,
  Loader2,
  AlertCircle,
  CheckCircle,
  Plus,
  X,
  Megaphone,
} from 'lucide-react';
import { useGit } from '@/hooks/useGit';
import { useFSPaths } from '@/hooks/useFSPaths';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostr } from '@/hooks/useNostr';
import { useToast } from '@/hooks/useToast';
import { nip19 } from 'nostr-tools';

interface AnnounceRepositoryDialogProps {
  projectId: string;
  remoteUrl?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AnnounceRepositoryDialog({
  projectId,
  remoteUrl,
  open,
  onOpenChange,
}: AnnounceRepositoryDialogProps) {
  const [isOpen, setIsOpen] = useState(open ?? false);
  const [repoId, setRepoId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [webUrls, setWebUrls] = useState<string[]>([]);
  const [cloneUrls, setCloneUrls] = useState<string[]>([]);
  const [relays, setRelays] = useState<string[]>(['wss://relay.nostr.band']);
  const [earliestCommit, setEarliestCommit] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdNaddr, setCreatedNaddr] = useState<string | null>(null);

  const [newWebUrl, setNewWebUrl] = useState('');
  const [newCloneUrl, setNewCloneUrl] = useState('');
  const [newRelay, setNewRelay] = useState('');

  const { git } = useGit();
  const { projectsPath } = useFSPaths();
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { toast } = useToast();

  const projectPath = `${projectsPath}/${projectId}`;

  useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);

  const parseRemoteUrl = useCallback((url: string) => {
    // Extract repo ID from Nostr URL
    if (url.startsWith('nostr://')) {
      const match = url.match(/^nostr:\/\/[^/]+\/(.+)$/);
      if (match) {
        const id = match[1];
        setRepoId(id);
        setName(id.split('/').pop() || id);
      }
    }

    // Add the remote URL as a clone URL
    if (url && !cloneUrls.includes(url)) {
      setCloneUrls([url]);
    }
  }, [cloneUrls]);

  const getEarliestCommit = useCallback(async () => {
    try {
      const commits = await git.log({
        dir: projectPath,
        ref: 'HEAD',
      });

      if (commits.length > 0) {
        // Get the earliest commit (last in the log)
        const earliest = commits[commits.length - 1];
        setEarliestCommit(earliest.oid);
      }
    } catch (err) {
      console.warn('Failed to get earliest commit:', err);
    }
  }, [git, projectPath]);

  useEffect(() => {
    if (isOpen && remoteUrl) {
      // Parse remote URL to pre-fill data
      parseRemoteUrl(remoteUrl);
      // Get earliest commit
      getEarliestCommit();
    }
  }, [isOpen, remoteUrl, parseRemoteUrl, getEarliestCommit]);

  const addWebUrl = () => {
    if (newWebUrl.trim() && !webUrls.includes(newWebUrl.trim())) {
      setWebUrls([...webUrls, newWebUrl.trim()]);
      setNewWebUrl('');
    }
  };

  const removeWebUrl = (index: number) => {
    setWebUrls(webUrls.filter((_, i) => i !== index));
  };

  const addCloneUrl = () => {
    if (newCloneUrl.trim() && !cloneUrls.includes(newCloneUrl.trim())) {
      setCloneUrls([...cloneUrls, newCloneUrl.trim()]);
      setNewCloneUrl('');
    }
  };

  const removeCloneUrl = (index: number) => {
    setCloneUrls(cloneUrls.filter((_, i) => i !== index));
  };

  const addRelay = () => {
    if (newRelay.trim() && !relays.includes(newRelay.trim())) {
      setRelays([...relays, newRelay.trim()]);
      setNewRelay('');
    }
  };

  const removeRelay = (index: number) => {
    setRelays(relays.filter((_, i) => i !== index));
  };

  const announceRepository = async () => {
    if (!user || !user.signer) {
      toast({
        title: 'Authentication required',
        description: 'Please log in with Nostr to announce repositories',
        variant: 'destructive',
      });
      return;
    }

    if (!repoId.trim()) {
      toast({
        title: 'Repository ID required',
        description: 'Please enter a repository identifier',
        variant: 'destructive',
      });
      return;
    }

    if (cloneUrls.length === 0) {
      toast({
        title: 'Clone URL required',
        description: 'Please add at least one clone URL',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Build tags array per NIP-34
      const tags: string[][] = [
        ['d', repoId.trim()], // Required: repository identifier
      ];

      if (name.trim()) {
        tags.push(['name', name.trim()]);
      }

      if (description.trim()) {
        tags.push(['description', description.trim()]);
      }

      // Add web URLs
      webUrls.forEach(url => {
        if (url.trim()) tags.push(['web', url.trim()]);
      });

      // Add clone URLs (required)
      cloneUrls.forEach(url => {
        if (url.trim()) tags.push(['clone', url.trim()]);
      });

      // Add relays for patch submissions
      relays.forEach(relay => {
        if (relay.trim()) tags.push(['relays', relay.trim()]);
      });

      // Add earliest unique commit (euc) for repository identification
      if (earliestCommit.trim()) {
        tags.push(['r', earliestCommit.trim(), 'euc']);
      }

      // Create repository announcement event (kind 30617)
      const repoEvent = {
        kind: 30617,
        content: '',
        tags,
        created_at: Math.floor(Date.now() / 1000),
      };

      console.log('=== ANNOUNCING REPOSITORY ===');
      console.log('Repository ID:', repoId.trim());
      console.log('Owner pubkey:', user.pubkey);
      console.log('Creating repository announcement event:', repoEvent);

      // Sign the event
      const signedEvent = await user.signer.signEvent(repoEvent);

      console.log('Signed repository announcement:', signedEvent);
      console.log('Event coordinate:', `30617:${user.pubkey}:${repoId.trim()}`);

      // Publish to Nostr relays
      await nostr.event(signedEvent);

      console.log('Published repository announcement to Nostr relays');
      console.log('To verify: Query for kind 30617 with authors=[' + user.pubkey + '] and #d=[' + repoId.trim() + ']');

      // Create naddr for the repository
      const naddr = nip19.naddrEncode({
        identifier: repoId.trim(),
        pubkey: user.pubkey,
        kind: 30617,
        relays: relays.length > 0 ? relays : undefined,
      });

      setCreatedNaddr(naddr);

      toast({
        title: 'Repository announced!',
        description: 'Your repository has been announced on Nostr',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast({
        title: 'Failed to announce repository',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen);
    onOpenChange?.(newOpen);

    // Reset form when closing
    if (!newOpen) {
      setRepoId('');
      setName('');
      setDescription('');
      setWebUrls([]);
      setCloneUrls([]);
      setRelays(['wss://relay.nostr.band']);
      setEarliestCommit('');
      setCreatedNaddr(null);
      setError(null);
      setNewWebUrl('');
      setNewCloneUrl('');
      setNewRelay('');
    }
  };

  const copyNaddr = () => {
    if (createdNaddr) {
      navigator.clipboard.writeText(createdNaddr);
      toast({
        title: 'Copied to clipboard',
        description: 'Repository address copied',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Megaphone className="h-4 w-4" />
          Announce Repository
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Announce Repository on Nostr
          </DialogTitle>
          <DialogDescription>
            Publish a repository announcement (NIP-34) to make it discoverable on Nostr git
            clients
          </DialogDescription>
        </DialogHeader>

        {createdNaddr ? (
          // Success state
          <div className="py-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Repository Announced!</h3>
              <p className="text-muted-foreground">
                Your repository is now discoverable on Nostr git clients
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <Label>Repository Address (naddr)</Label>
              <div className="flex gap-2">
                <Input
                  value={createdNaddr}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyNaddr}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this address with others to let them find your repository
              </p>
            </div>
          </div>
        ) : (
          // Form
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 pr-4">
              {/* Error alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Repository ID */}
              <div className="space-y-2">
                <Label htmlFor="repo-id">Repository ID *</Label>
                <Input
                  id="repo-id"
                  placeholder="e.g., my-project or username/repo-name"
                  value={repoId}
                  onChange={(e) => setRepoId(e.target.value)}
                  disabled={isCreating}
                />
                <p className="text-xs text-muted-foreground">
                  Unique identifier for this repository (like GitHub's owner/repo)
                </p>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="repo-name">Name</Label>
                <Input
                  id="repo-name"
                  placeholder="Human-readable project name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isCreating}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="repo-description">Description</Label>
                <Textarea
                  id="repo-description"
                  placeholder="Brief description of your project"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  disabled={isCreating}
                />
              </div>

              {/* Web URLs */}
              <div className="space-y-2">
                <Label>Web URLs (Optional)</Label>
                <div className="space-y-2">
                  {webUrls.map((url, index) => (
                    <div key={index} className="flex gap-2">
                      <Input value={url} readOnly className="flex-1" />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => removeWebUrl(index)}
                        disabled={isCreating}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://example.com/browse"
                      value={newWebUrl}
                      onChange={(e) => setNewWebUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addWebUrl())}
                      disabled={isCreating}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={addWebUrl}
                      disabled={isCreating}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  URLs where the repository can be browsed online
                </p>
              </div>

              {/* Clone URLs */}
              <div className="space-y-2">
                <Label>Clone URLs *</Label>
                <div className="space-y-2">
                  {cloneUrls.map((url, index) => (
                    <div key={index} className="flex gap-2">
                      <Input value={url} readOnly className="flex-1 font-mono text-sm" />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => removeCloneUrl(index)}
                        disabled={isCreating}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      placeholder="nostr://npub.../repo-id"
                      value={newCloneUrl}
                      onChange={(e) => setNewCloneUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCloneUrl())}
                      disabled={isCreating}
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={addCloneUrl}
                      disabled={isCreating}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  URLs for cloning the repository (at least one required)
                </p>
              </div>

              {/* Relays */}
              <div className="space-y-2">
                <Label>Relays for Patches</Label>
                <div className="space-y-2">
                  {relays.map((relay, index) => (
                    <div key={index} className="flex gap-2">
                      <Input value={relay} readOnly className="flex-1 font-mono text-sm" />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => removeRelay(index)}
                        disabled={isCreating || relays.length === 1}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      placeholder="wss://relay.example.com"
                      value={newRelay}
                      onChange={(e) => setNewRelay(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRelay())}
                      disabled={isCreating}
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={addRelay}
                      disabled={isCreating}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Relays where patches will be published and monitored
                </p>
              </div>

              {/* Earliest Commit */}
              <div className="space-y-2">
                <Label htmlFor="earliest-commit">Earliest Unique Commit</Label>
                <Input
                  id="earliest-commit"
                  placeholder="Commit hash"
                  value={earliestCommit}
                  onChange={(e) => setEarliestCommit(e.target.value)}
                  disabled={isCreating}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  The root commit of your repository (auto-detected when available)
                </p>
              </div>
            </div>
          </ScrollArea>
        )}

        {!createdNaddr && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button onClick={announceRepository} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Announcing...
                </>
              ) : (
                <>
                  <GitBranch className="h-4 w-4 mr-2" />
                  Announce Repository
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
