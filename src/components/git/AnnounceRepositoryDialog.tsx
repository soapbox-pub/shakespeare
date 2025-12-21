import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TagInput } from '@/components/ui/tag-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  GitBranch,
  Loader2,
  AlertCircle,
  Plus,
  X,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { useGit } from '@/hooks/useGit';
import { useFSPaths } from '@/hooks/useFSPaths';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostr } from '@/hooks/useNostr';
import { useToast } from '@/hooks/useToast';
import { useAppContext } from '@/hooks/useAppContext';
import { useFS } from '@/hooks/useFS';
import { DotAI } from '@/lib/DotAI';
import { nip19 } from 'nostr-tools';
import {
  createRepositoryAnnouncementEvent,
  createRepositoryNaddr,
  validateRepositoryAnnouncementData,
  validateRepositoryId,
  parseRepositoryAnnouncement,
} from '@/lib/announceRepository';

export interface AnnounceRepositoryResult {
  repoId: string;
  cloneUrls: string[];
  relays: string[];
  naddr: string;
}

interface AnnounceRepositoryDialogProps {
  projectId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: (result: AnnounceRepositoryResult) => void;
  /** Repository naddr to edit (if editing existing repo) */
  editNaddr?: string;
}

export function AnnounceRepositoryDialog({
  projectId,
  open,
  onOpenChange,
  onSuccess,
  editNaddr,
}: AnnounceRepositoryDialogProps) {
  const [isOpen, setIsOpen] = useState(open ?? false);
  const [isPrepopulated, setIsPrepopulated] = useState(false);
  const [repoId, setRepoId] = useState('');
  const [repoIdError, setRepoIdError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [webUrls, setWebUrls] = useState<string[]>([]);
  const [cloneUrls, setCloneUrls] = useState<string[]>([]);
  const [relays, setRelays] = useState<string[]>([]);
  const [tTags, setTTags] = useState<string[]>([]);
  const [earliestCommit, setEarliestCommit] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newWebUrl, setNewWebUrl] = useState('');
  const [newCloneUrl, setNewCloneUrl] = useState('');
  const [newRelay, setNewRelay] = useState('');

  const { git } = useGit();
  const { projectsPath } = useFSPaths();
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { toast } = useToast();
  const { config } = useAppContext();
  const { fs } = useFS();

  const projectPath = `${projectsPath}/${projectId}`;

  useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);

  // Convert projectId to kebab-case for repo ID
  const toKebabCase = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  // Validate repository ID on change
  const handleRepoIdChange = (value: string) => {
    setRepoId(value);
    try {
      validateRepositoryId(value);
      setRepoIdError(null);
    } catch (err) {
      setRepoIdError(err instanceof Error ? err.message : 'Invalid repository ID');
    }
  };

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

  const prepopulateFields = useCallback(async () => {
    // Set default repo ID from project ID (kebab-case)
    const defaultRepoId = toKebabCase(projectId);
    setRepoId(defaultRepoId);

    // Set default name from project ID (title case)
    const defaultName = projectId
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    setName(defaultName);

    // Prepopulate clone URLs and relays from grasp servers (matching original handlePushToNostr)
    if (user?.pubkey && config.graspMetadata.relays && config.graspMetadata.relays.length > 0) {
      const npub = nip19.npubEncode(user.pubkey);

      // Clone URLs: https://{hostname}/{npub}/{repo-id}.git
      const cloneUrls = config.graspMetadata.relays.map(relay => {
        try {
          const url = new URL(relay.url);
          return `https://${url.hostname}/${npub}/${defaultRepoId}.git`;
        } catch {
          // Fallback: extract hostname from URL string
          const hostname = relay.url.replace(/^wss?:\/\//, '').replace(/\/.*$/, '');
          return `https://${hostname}/${npub}/${defaultRepoId}.git`;
        }
      });
      setCloneUrls(cloneUrls);

      // Relay URLs from grasp metadata
      const relayUrls = config.graspMetadata.relays.map(r => r.url);
      setRelays(relayUrls);
    } else {
      // Fallback to write relays if no grasp servers configured
      const writeRelays = config.relayMetadata.relays
        .filter(r => r.write)
        .map(r => r.url);
      setRelays(writeRelays.length > 0 ? writeRelays : ['wss://relay.nostr.band']);
    }

    // Prepopulate t-tags
    const defaultTTags: string[] = ['shakespeare'];

    // Try to read template.json to get template name
    try {
      const dotAI = new DotAI(fs, projectPath);
      const template = await dotAI.readTemplate();
      if (template?.name) {
        // Convert template name to lowercase and add as t-tag
        const templateTag = template.name.toLowerCase();
        if (!defaultTTags.includes(templateTag)) {
          defaultTTags.push(templateTag);
        }
      }
    } catch (error) {
      console.warn('Failed to read template for t-tags:', error);
    }

    setTTags(defaultTTags);

    // Get earliest commit
    await getEarliestCommit();
  }, [projectId, projectPath, fs, config.relayMetadata, config.graspMetadata.relays, user?.pubkey, getEarliestCommit]);

  // Load existing repository data if editing, or prepopulate fields for new repos
  useEffect(() => {
    // Only run when dialog opens
    if (!isOpen || isPrepopulated) return;

    const loadExistingRepo = async () => {
      if (!editNaddr) return;

      try {
        // Decode the naddr to get repository coordinates
        const decoded = nip19.decode(editNaddr);
        if (decoded.type !== 'naddr') {
          throw new Error('Invalid repository identifier');
        }

        const { identifier, pubkey, kind, relays: naddrRelays } = decoded.data;

        // Query for the repository announcement event
        const filter = {
          kinds: [kind],
          authors: [pubkey],
          '#d': [identifier],
        };

        const signal = AbortSignal.timeout(3000);
        const readRelays = config.relayMetadata.relays
          .filter(r => r.read)
          .map(r => r.url);
        const events = await nostr.query([filter], {
          signal,
          relays: naddrRelays && naddrRelays.length > 0 ? naddrRelays : readRelays
        });

        if (events.length === 0) {
          throw new Error('Repository announcement not found');
        }

        // Use the most recent event
        const event = events.sort((a, b) => b.created_at - a.created_at)[0];

        // Parse the NIP-34 repository announcement
        const parsed = parseRepositoryAnnouncement(event);

        setRepoId(parsed.identifier);
        setName(parsed.name || '');
        setDescription(parsed.description || '');
        setWebUrls(parsed.webUrls);
        setCloneUrls(parsed.httpsCloneUrls);
        setRelays(parsed.relays);
        setEarliestCommit(parsed.earliestCommit || '');

        // Extract t-tags from the event
        const extractedTTags = parsed.event.tags
          .filter(([name]) => name === 't')
          .map(([, value]) => value)
          .filter((value): value is string => !!value);
        setTTags(extractedTTags);

        setIsPrepopulated(true);
      } catch (error) {
        console.error('Failed to load repository data:', error);
        toast({
          title: 'Failed to load repository',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    };

    if (editNaddr) {
      loadExistingRepo();
    } else {
      prepopulateFields();
      setIsPrepopulated(true);
    }
  }, [isOpen, isPrepopulated, editNaddr, nostr, config.relayMetadata, toast, prepopulateFields]);

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
    const trimmedUrl = newCloneUrl.trim();

    // Prevent nostr:// URLs in clone URLs
    if (trimmedUrl.startsWith('nostr://')) {
      toast({
        title: 'Invalid clone URL',
        description: 'Clone URLs must be HTTPS URLs, not nostr:// URLs',
        variant: 'destructive',
      });
      return;
    }

    if (trimmedUrl && !cloneUrls.includes(trimmedUrl)) {
      setCloneUrls([...cloneUrls, trimmedUrl]);
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

    setIsCreating(true);
    setError(null);

    try {
      // Validate data
      validateRepositoryAnnouncementData({
        repoId,
        cloneUrls,
      });

      // Create repository announcement event using shared utility
      const repoEvent = createRepositoryAnnouncementEvent({
        repoId,
        name,
        description,
        webUrls,
        cloneUrls,
        relays,
        tTags,
        earliestCommit,
      });

      console.log('=== ANNOUNCING REPOSITORY ===');
      console.log('Repository ID:', repoId.trim());
      console.log('Owner pubkey:', user.pubkey);
      console.log('Creating repository announcement event:', repoEvent);

      // Sign the event
      const signedEvent = await user.signer.signEvent(repoEvent);

      console.log('Signed repository announcement:', signedEvent);
      console.log('Event coordinate:', `30617:${user.pubkey}:${repoId.trim()}`);

      // Publish to Nostr relays
      // Repository announcements go to: write relays + relays specified in the announcement
      const writeRelays = config.relayMetadata.relays
        .filter(r => r.write)
        .map(r => r.url);
      const publishRelays = [...new Set([...writeRelays, ...relays])];
      console.log('Publishing repository announcement to relays:', publishRelays);

      await nostr.event(signedEvent, { relays: publishRelays });

      console.log('Published repository announcement to Nostr relays');
      console.log('To verify: Query for kind 30617 with authors=[' + user.pubkey + '] and #d=[' + repoId.trim() + ']');

      // Create naddr for the repository using shared utility
      const naddr = createRepositoryNaddr(repoId, user.pubkey, relays);

      toast({
        title: 'Published Nostr announcement',
        description: 'Configuring repository...',
      });

      // Close the dialog
      handleOpenChange(false);

      // Call success callback with the data needed for Git operations
      onSuccess?.({
        repoId: repoId.trim(),
        cloneUrls,
        relays,
        naddr,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast({
        title: 'Failed to announce repository',
        description: errorMessage,
        variant: 'destructive',
        duration: Infinity,
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
      setIsPrepopulated(false);
      setRepoId('');
      setName('');
      setDescription('');
      setWebUrls([]);
      setCloneUrls([]);
      setRelays(['wss://relay.nostr.band']);
      setTTags([]);
      setEarliestCommit('');
      setError(null);
      setNewWebUrl('');
      setNewCloneUrl('');
      setNewRelay('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {editNaddr ? 'Edit' : ''} Nostr Repository Settings
          </DialogTitle>
          <DialogDescription>
            {editNaddr
              ? 'Update your repository announcement (NIP-34) for Nostr git clients'
              : 'Configure your repository announcement (NIP-34) for Nostr git clients'
            }
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 p-1 pr-4">
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
                placeholder="e.g., my-project"
                value={repoId}
                onChange={(e) => handleRepoIdChange(e.target.value)}
                disabled={isCreating}
                className={repoIdError ? 'border-destructive' : ''}
              />
              {repoIdError ? (
                <p className="text-xs text-destructive">{repoIdError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                    Kebab-case short name (e.g., "my-project", "awesome-app")
                </p>
              )}
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
              <p className="text-xs text-muted-foreground">
                  Display name for your repository
              </p>
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

            {/* Advanced Settings */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between p-0 hover:bg-transparent"
                >
                  <span className="text-sm font-medium">Advanced Settings</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      showAdvanced ? 'rotate-180' : ''
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-6 pt-4">
                {/* Web URLs */}
                <div className="space-y-2">
                  <Label>Web URLs (Optional)</Label>
                  <div className="space-y-2">
                    {webUrls.map((url, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={url}
                          onChange={(e) => {
                            const newUrls = [...webUrls];
                            newUrls[index] = e.target.value;
                            setWebUrls(newUrls);
                          }}
                          className="flex-1"
                          disabled={isCreating}
                        />
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
                        onKeyDown={(e) =>
                          e.key === 'Enter' && (e.preventDefault(), addWebUrl())
                        }
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
                  <Label>Git Server Clone URLs</Label>
                  <div className="space-y-2">
                    {cloneUrls.map((url, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={url}
                          onChange={(e) => {
                            const newUrls = [...cloneUrls];
                            newUrls[index] = e.target.value;
                            setCloneUrls(newUrls);
                          }}
                          className="flex-1 font-mono text-sm"
                          disabled={isCreating}
                        />
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
                        placeholder="https://gitnostr.com/..."
                        value={newCloneUrl}
                        onChange={(e) => setNewCloneUrl(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === 'Enter' && (e.preventDefault(), addCloneUrl())
                        }
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
                      HTTPS URLs for cloning the repository (nostr:// URLs not allowed)
                  </p>
                </div>

                {/* Relays */}
                <div className="space-y-2">
                  <Label>Git Nostr Relays</Label>
                  <div className="space-y-2">
                    {relays.map((relay, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={relay}
                          onChange={(e) => {
                            const newRelays = [...relays];
                            newRelays[index] = e.target.value;
                            setRelays(newRelays);
                          }}
                          className="flex-1 font-mono text-sm"
                          disabled={isCreating}
                        />
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
                      Nostr relays where patches and issues will be published and monitored
                  </p>
                </div>

                {/* Category Tags (t-tags) */}
                <div className="space-y-2">
                  <Label htmlFor="category-tags">Category Tags</Label>
                  <TagInput
                    id="category-tags"
                    value={tTags}
                    onChange={setTTags}
                    placeholder="e.g., nostr, social, web"
                    disabled={isCreating}
                    transformTag={(tag) => tag.trim().toLowerCase()}
                    allowDuplicates={false}
                  />
                  <p className="text-xs text-muted-foreground">
                      Tags for categorizing your repository. Press space or comma to add a tag.
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
                      The root commit of your repository (auto-detected)
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isCreating}
          >
              Cancel
          </Button>
          <Button
            onClick={announceRepository}
            disabled={isCreating || !!repoIdError || !repoId.trim()}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {editNaddr ? 'Updating...' : 'Publishing...'}
              </>
            ) : (
              <>
                <GitBranch className="h-4 w-4 mr-2" />
                {editNaddr ? 'Update on Nostr' : 'Publish to Nostr'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
