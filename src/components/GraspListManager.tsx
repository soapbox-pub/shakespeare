import { useState, useEffect } from 'react';
import { Plus, X, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useAppContext } from '@/hooks/useAppContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { toast } from '@/hooks/useToast';

export function GraspListManager() {
  const { config, updateConfig } = useAppContext();
  const { user } = useCurrentUser();
  const { mutate: publishEvent } = useNostrPublish();

  const [graspRelays, setGraspRelays] = useState<{ url: string }[]>(config.graspMetadata.relays);
  const [newRelayUrl, setNewRelayUrl] = useState('');

  // Sync local state with config when it changes (e.g., from NostrProvider sync)
  useEffect(() => {
    setGraspRelays(config.graspMetadata.relays);
  }, [config.graspMetadata.relays]);

  const normalizeRelayUrl = (url: string): string => {
    url = url.trim();
    try {
      const parsed = new URL(url);
      // Ensure it's a websocket URL
      if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
        parsed.protocol = 'wss:';
      }
      // Ensure trailing slash
      if (!parsed.pathname.endsWith('/')) {
        parsed.pathname += '/';
      }
      return parsed.toString();
    } catch {
      // If parsing fails, try to construct a valid URL
      try {
        const withProtocol = url.startsWith('ws://') || url.startsWith('wss://')
          ? url
          : `wss://${url}`;
        const parsed = new URL(withProtocol);
        if (!parsed.pathname.endsWith('/')) {
          parsed.pathname += '/';
        }
        return parsed.toString();
      } catch {
        return url;
      }
    }
  };

  const isValidRelayUrl = (url: string): boolean => {
    const trimmed = url.trim();
    if (!trimmed) return false;

    const normalized = normalizeRelayUrl(trimmed);
    try {
      const parsed = new URL(normalized);
      return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
    } catch {
      return false;
    }
  };

  const handleAddRelay = () => {
    if (!isValidRelayUrl(newRelayUrl)) {
      toast({
        title: 'Invalid relay URL',
        description: 'Please enter a valid websocket URL (e.g., wss://git.shakespeare.diy/)',
        variant: 'destructive',
      });
      return;
    }

    const normalized = normalizeRelayUrl(newRelayUrl);

    if (graspRelays.some(r => r.url === normalized)) {
      toast({
        title: 'Relay already exists',
        description: 'This relay is already in your list',
        variant: 'destructive',
      });
      return;
    }

    const newRelays = [...graspRelays, { url: normalized }];
    setGraspRelays(newRelays);
    setNewRelayUrl('');

    saveRelays(newRelays);
  };

  const handleRemoveRelay = (url: string) => {
    const newRelays = graspRelays.filter(r => r.url !== url);
    setGraspRelays(newRelays);
    saveRelays(newRelays);
  };

  const saveRelays = (newRelays: { url: string }[]) => {
    const now = Math.floor(Date.now() / 1000);

    // Update local config
    updateConfig((current) => ({
      ...current,
      graspMetadata: {
        relays: newRelays,
        updatedAt: now,
      },
    }));

    // Publish to Nostr if user is logged in
    if (user) {
      publishNIP34GraspList(newRelays);
    }
  };

  const publishNIP34GraspList = (relays: { url: string }[]) => {
    const tags = relays.map(relay => ['g', relay.url]);

    publishEvent(
      {
        kind: 10317,
        content: '',
        tags,
      },
      {
        onSuccess: () => {
          toast({
            title: 'Grasp list published',
            description: 'Your Nostr git server list has been published to your relays',
          });
        },
        onError: (error) => {
          console.error('Failed to publish grasp list:', error);
          toast({
            title: 'Publish failed',
            description: 'Failed to publish your grasp server list',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const renderRelayUrl = (url: string): string => {
    try {
      const parsed = new URL(url);
      if (parsed.pathname === '/') {
        return parsed.host;
      } else {
        return parsed.host + parsed.pathname;
      }
    } catch {
      return url;
    }
  };

  return (
    <div className="space-y-4">
      {/* Relay List */}
      <div className="space-y-2">
        {graspRelays.map((relay) => (
          <div
            key={relay.url}
            className="flex items-center gap-2 p-2 rounded-md border bg-muted/20"
          >
            <Server className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-mono text-sm flex-1 truncate" title={relay.url}>
              {renderRelayUrl(relay.url)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveRelay(relay.url)}
              className="size-5 text-muted-foreground hover:text-destructive hover:bg-transparent shrink-0"
              disabled={graspRelays.length <= 1}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add Relay Form */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="new-grasp-relay" className="sr-only">
            Grasp Relay URL
          </Label>
          <Input
            id="new-grasp-relay"
            placeholder="wss://git.shakespeare.diy/"
            value={newRelayUrl}
            onChange={(e) => setNewRelayUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddRelay();
              }
            }}
          />
        </div>
        <Button
          onClick={handleAddRelay}
          disabled={!newRelayUrl.trim()}
          variant="outline"
          size="sm"
          className="h-10 shrink-0"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>

      {!user && (
        <p className="text-xs text-muted-foreground">
          Log in to sync your grasp server list with Nostr
        </p>
      )}
    </div>
  );
}
