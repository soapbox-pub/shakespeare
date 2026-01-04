import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { DeployProvider } from '@/contexts/DeploySettingsContext';
import type { PresetDeployProvider } from '@/lib/deploy/types';
import { ExternalFavicon } from '@/components/ExternalFavicon';

interface ProviderConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: DeployProvider;
  preset?: PresetDeployProvider;
  onUpdate: (provider: DeployProvider) => void;
  onRemove: () => void;
}

/**
 * Normalize a URL string to ensure it has a protocol
 * @param url - The URL string to normalize
 * @returns A fully-qualified URL string
 */
function normalizeUrl(url: string): string {
  // If it already has a protocol, return as-is
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  // Add https:// prefix
  return `https://${url}`;
}

export function ProviderConfigDialog({
  open,
  onOpenChange,
  provider,
  preset,
  onUpdate,
  onRemove,
}: ProviderConfigDialogProps) {
  const { t } = useTranslation();
  const [localProvider, setLocalProvider] = useState(provider);

  // Reset local state when provider changes or dialog opens
  useEffect(() => {
    if (open) {
      setLocalProvider(provider);
    }
  }, [provider, open]);

  const handleSave = () => {
    onUpdate(localProvider);
    onOpenChange(false);
  };

  const handleDelete = () => {
    onRemove();
    onOpenChange(false);
  };

  // Use baseURL from configured provider, falling back to preset baseURL
  const baseURL = ('baseURL' in localProvider && localProvider.baseURL) || preset?.baseURL;

  // For Shakespeare, special handling for host field
  const shakespeareUrl = localProvider.type === 'shakespeare' && 'host' in localProvider && localProvider.host
    ? normalizeUrl(localProvider.host)
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ExternalFavicon
              url={shakespeareUrl || baseURL}
              size={20}
              fallback={<Rocket size={20} />}
            />
            <DialogTitle>{localProvider.name}</DialogTitle>
          </div>
          <DialogDescription>
            {preset?.description || 'Configure your deployment provider'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="provider-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="provider-name"
              placeholder="Provider name"
              value={localProvider.name}
              onChange={(e) => setLocalProvider({ ...localProvider, name: e.target.value })}
            />
          </div>

          {localProvider.type === 'shakespeare' ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t('shakespeareDeployNostrAuth')}
              </p>
              <div className="grid gap-2">
                <Label htmlFor="provider-host">
                  Host (Optional)
                </Label>
                <Input
                  id="provider-host"
                  placeholder="shakespeare.wtf"
                  value={localProvider.host || ''}
                  onChange={(e) => setLocalProvider({ ...localProvider, host: e.target.value })}
                />
              </div>
            </>
          ) : localProvider.type === 'nsite' ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="provider-gateway">
                  Gateway <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="provider-gateway"
                  placeholder="nsite.lol"
                  value={localProvider.gateway || ''}
                  onChange={(e) => setLocalProvider({ ...localProvider, gateway: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="provider-relays">
                  Relay URLs (comma-separated) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="provider-relays"
                  placeholder="wss://relay.nostr.band, wss://relay.damus.io"
                  value={localProvider.relayUrls?.join(', ') || ''}
                  onChange={(e) => setLocalProvider({
                    ...localProvider,
                    relayUrls: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="provider-blossom">
                  Blossom Servers (comma-separated) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="provider-blossom"
                  placeholder="https://blossom.primal.net/"
                  value={localProvider.blossomServers?.join(', ') || ''}
                  onChange={(e) => setLocalProvider({
                    ...localProvider,
                    blossomServers: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  })}
                />
              </div>
            </>
          ) : (
            <>
              {localProvider.type === 'cloudflare' && (
                <div className="grid gap-2">
                  <Label htmlFor="provider-accountId">
                    {preset?.accountIdLabel || 'Account ID'} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="provider-accountId"
                    placeholder="Enter Account ID"
                    value={localProvider.accountId}
                    onChange={(e) => setLocalProvider({ ...localProvider, accountId: e.target.value })}
                  />
                </div>
              )}
              {localProvider.type === 'deno' && (
                <div className="grid gap-2">
                  <Label htmlFor="provider-organizationId">
                    {preset?.organizationIdLabel || 'Organization ID'} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="provider-organizationId"
                    placeholder="Enter Organization ID"
                    value={localProvider.organizationId}
                    onChange={(e) => setLocalProvider({ ...localProvider, organizationId: e.target.value })}
                  />
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="provider-apiKey">
                  {preset?.apiKeyLabel || t('apiKey')} <span className="text-destructive">*</span>
                </Label>
                <PasswordInput
                  id="provider-apiKey"
                  placeholder={t('enterApiKey')}
                  value={localProvider.apiKey}
                  onChange={(e) => {
                    if (localProvider.type === 'netlify') {
                      setLocalProvider({ ...localProvider, apiKey: e.target.value });
                    } else if (localProvider.type === 'vercel') {
                      setLocalProvider({ ...localProvider, apiKey: e.target.value });
                    } else if (localProvider.type === 'cloudflare') {
                      setLocalProvider({ ...localProvider, apiKey: e.target.value });
                    } else if (localProvider.type === 'deno') {
                      setLocalProvider({ ...localProvider, apiKey: e.target.value });
                    }
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="provider-baseURL">
                  Base URL (Optional)
                </Label>
                <Input
                  id="provider-baseURL"
                  placeholder={
                    localProvider.type === 'netlify' ? 'https://api.netlify.com/api/v1' :
                      localProvider.type === 'vercel' ? 'https://api.vercel.com' :
                        localProvider.type === 'cloudflare' ? 'https://api.cloudflare.com/client/v4' :
                          localProvider.type === 'deno' ? 'https://api.deno.com/v1' :
                            'Base URL'
                  }
                  value={localProvider.baseURL || ''}
                  onChange={(e) => {
                    if (localProvider.type === 'netlify') {
                      setLocalProvider({ ...localProvider, baseURL: e.target.value });
                    } else if (localProvider.type === 'vercel') {
                      setLocalProvider({ ...localProvider, baseURL: e.target.value });
                    } else if (localProvider.type === 'cloudflare') {
                      setLocalProvider({ ...localProvider, baseURL: e.target.value });
                    } else if (localProvider.type === 'deno') {
                      setLocalProvider({ ...localProvider, baseURL: e.target.value });
                    }
                  }}
                />
              </div>
              {(localProvider.type === 'cloudflare' || localProvider.type === 'deno') && (
                <div className="grid gap-2">
                  <Label htmlFor="provider-baseDomain">
                    Base Domain (Optional)
                  </Label>
                  <Input
                    id="provider-baseDomain"
                    placeholder={localProvider.type === 'cloudflare' ? 'workers.dev' : 'deno.dev'}
                    value={localProvider.baseDomain || ''}
                    onChange={(e) => setLocalProvider({ ...localProvider, baseDomain: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {localProvider.type === 'cloudflare'
                      ? 'The domain suffix for deployed workers (e.g., workers.dev)'
                      : 'The domain suffix for deployed projects (e.g., deno.dev)'}
                  </p>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="provider-proxy"
                  checked={localProvider.proxy || false}
                  onCheckedChange={(checked) => setLocalProvider({ ...localProvider, proxy: checked === true })}
                />
                <Label
                  htmlFor="provider-proxy"
                  className="text-sm font-normal cursor-pointer"
                >
                  Use CORS Proxy
                </Label>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="destructive"
            onClick={handleDelete}
            className="sm:mr-auto"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('delete')}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave}>
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
