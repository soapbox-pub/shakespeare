import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  ShakespeareDeployProvider,
  NetlifyProvider,
  VercelProvider,
  NsiteProvider,
  CloudflareProvider,
  DenoDeployProvider,
  RailwayProvider,
} from '@/contexts/DeploySettingsContext';

// Type for provider without the 'id' field (will be generated)
type DeployProviderInput =
  | Omit<ShakespeareDeployProvider, 'id'>
  | Omit<NetlifyProvider, 'id'>
  | Omit<VercelProvider, 'id'>
  | Omit<NsiteProvider, 'id'>
  | Omit<CloudflareProvider, 'id'>
  | Omit<DenoDeployProvider, 'id'>
  | Omit<RailwayProvider, 'id'>;

interface AddCustomProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (provider: DeployProviderInput) => void;
}

export function AddCustomProviderDialog({
  open,
  onOpenChange,
  onAdd,
}: AddCustomProviderDialogProps) {
  const { t } = useTranslation();
  const [customProviderType, setCustomProviderType] = useState<'shakespeare' | 'netlify' | 'vercel' | 'nsite' | 'cloudflare' | 'deno' | 'railway' | ''>('');
  const [customName, setCustomName] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customAccountId, setCustomAccountId] = useState('');
  const [customOrganizationId, setCustomOrganizationId] = useState('');
  const [customBaseURL, setCustomBaseURL] = useState('');
  const [customBaseDomain, setCustomBaseDomain] = useState('');
  const [customHost, setCustomHost] = useState('');
  const [customProxy, setCustomProxy] = useState(false);
  const [customGateway, setCustomGateway] = useState('');
  const [customRelayUrls, setCustomRelayUrls] = useState('');
  const [customBlossomServers, setCustomBlossomServers] = useState('');

  const handleAdd = () => {
    if (!customProviderType || !customName.trim()) return;

    // Build provider object based on type
    let provider: DeployProviderInput;

    if (customProviderType === 'shakespeare') {
      provider = {
        type: 'shakespeare',
        name: customName.trim(),
        ...(customHost?.trim() && { host: customHost.trim() }),
        ...(customProxy && { proxy: true }),
      };
    } else if (customProviderType === 'nsite') {
      provider = {
        type: 'nsite',
        name: customName.trim(),
        gateway: customGateway.trim() || 'nsite.lol',
        relayUrls: customRelayUrls.trim()
          ? customRelayUrls.split(',').map(s => s.trim()).filter(Boolean)
          : ['wss://relay.nostr.band'],
        blossomServers: customBlossomServers.trim()
          ? customBlossomServers.split(',').map(s => s.trim()).filter(Boolean)
          : ['https://blossom.primal.net/'],
      };
    } else if (customProviderType === 'netlify') {
      if (!customApiKey.trim()) return;
      provider = {
        type: 'netlify',
        name: customName.trim(),
        apiKey: customApiKey.trim(),
        ...(customBaseURL?.trim() && { baseURL: customBaseURL.trim() }),
        ...(customProxy && { proxy: true }),
      };
    } else if (customProviderType === 'vercel') {
      if (!customApiKey.trim()) return;
      provider = {
        type: 'vercel',
        name: customName.trim(),
        apiKey: customApiKey.trim(),
        ...(customBaseURL?.trim() && { baseURL: customBaseURL.trim() }),
        ...(customProxy && { proxy: true }),
      };
    } else if (customProviderType === 'cloudflare') {
      if (!customApiKey.trim() || !customAccountId.trim()) return;
      provider = {
        type: 'cloudflare',
        name: customName.trim(),
        apiKey: customApiKey.trim(),
        accountId: customAccountId.trim(),
        ...(customBaseURL?.trim() && { baseURL: customBaseURL.trim() }),
        ...(customBaseDomain?.trim() && { baseDomain: customBaseDomain.trim() }),
        ...(customProxy && { proxy: true }),
      };
    } else if (customProviderType === 'deno') {
      if (!customApiKey.trim() || !customOrganizationId.trim()) return;
      provider = {
        type: 'deno',
        name: customName.trim(),
        apiKey: customApiKey.trim(),
        organizationId: customOrganizationId.trim(),
        ...(customBaseURL?.trim() && { baseURL: customBaseURL.trim() }),
        ...(customBaseDomain?.trim() && { baseDomain: customBaseDomain.trim() }),
        ...(customProxy && { proxy: true }),
      };
    } else if (customProviderType === 'railway') {
      if (!customApiKey.trim()) return;
      provider = {
        type: 'railway',
        name: customName.trim(),
        apiKey: customApiKey.trim(),
        ...(customBaseURL?.trim() && { baseURL: customBaseURL.trim() }),
        ...(customProxy && { proxy: true }),
      };
    } else {
      return; // Unknown type
    }

    onAdd(provider);

    // Reset form
    setCustomProviderType('');
    setCustomName('');
    setCustomApiKey('');
    setCustomAccountId('');
    setCustomOrganizationId('');
    setCustomBaseURL('');
    setCustomBaseDomain('');
    setCustomHost('');
    setCustomProxy(false);
    setCustomGateway('');
    setCustomRelayUrls('');
    setCustomBlossomServers('');

    onOpenChange(false);
  };

  const isValid = customProviderType && customName.trim() &&
    (customProviderType === 'shakespeare' || customProviderType === 'nsite' ||
      (customApiKey.trim() &&
        (customProviderType !== 'cloudflare' || customAccountId.trim()) &&
        (customProviderType !== 'deno' || customOrganizationId.trim()) &&
        (customProviderType !== 'railway' || true)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('addCustomProvider')}</DialogTitle>
          <DialogDescription>
            Configure a custom deployment provider with your own settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="custom-provider-type">
              {t('providerType')} <span className="text-destructive">*</span>
            </Label>
            <Select
              value={customProviderType}
              onValueChange={(value: 'shakespeare' | 'netlify' | 'vercel' | 'nsite' | 'cloudflare' | 'deno' | 'railway') => {
                setCustomProviderType(value);
                // Reset form when provider type changes
                setCustomApiKey('');
                setCustomAccountId('');
                setCustomOrganizationId('');
                setCustomBaseURL('');
                setCustomBaseDomain('');
                setCustomHost('');
                setCustomProxy(false);
                setCustomGateway('');
                setCustomRelayUrls('');
                setCustomBlossomServers('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('selectProviderType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shakespeare">Shakespeare Deploy</SelectItem>
                <SelectItem value="nsite">nsite</SelectItem>
                <SelectItem value="netlify">Netlify</SelectItem>
                <SelectItem value="vercel">Vercel</SelectItem>
                <SelectItem value="cloudflare">Cloudflare</SelectItem>
                <SelectItem value="deno">Deno Deploy</SelectItem>
                <SelectItem value="railway">Railway</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {customProviderType && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="custom-name">
                  {t('providerName')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="custom-name"
                  placeholder="e.g., My Production Deploy"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </div>

              {customProviderType === 'shakespeare' ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {t('shakespeareDeployNostrAuth')}
                  </p>
                  <div className="grid gap-2">
                    <Label htmlFor="custom-host">Host (Optional)</Label>
                    <Input
                      id="custom-host"
                      placeholder="shakespeare.wtf"
                      value={customHost}
                      onChange={(e) => setCustomHost(e.target.value)}
                    />
                  </div>
                </>
              ) : customProviderType === 'nsite' ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Deploy to Nostr as a static website. Uses kind 34128 events and Blossom file storage.
                  </p>
                  <div className="grid gap-2">
                    <Label htmlFor="custom-gateway">Gateway</Label>
                    <Input
                      id="custom-gateway"
                      placeholder="nsite.lol"
                      value={customGateway}
                      onChange={(e) => setCustomGateway(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="custom-relays">Relay URLs (comma-separated)</Label>
                    <Input
                      id="custom-relays"
                      placeholder="wss://relay.nostr.band, wss://relay.damus.io"
                      value={customRelayUrls}
                      onChange={(e) => setCustomRelayUrls(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="custom-blossom">Blossom Servers (comma-separated)</Label>
                    <Input
                      id="custom-blossom"
                      placeholder="https://blossom.primal.net/"
                      value={customBlossomServers}
                      onChange={(e) => setCustomBlossomServers(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  {customProviderType === 'cloudflare' && (
                    <div className="grid gap-2">
                      <Label htmlFor="custom-accountid">
                        Account ID <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="custom-accountid"
                        placeholder="Enter Account ID"
                        value={customAccountId}
                        onChange={(e) => setCustomAccountId(e.target.value)}
                      />
                    </div>
                  )}
                  {customProviderType === 'deno' && (
                    <div className="grid gap-2">
                      <Label htmlFor="custom-organizationid">
                        Organization ID <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="custom-organizationid"
                        placeholder="Enter Organization ID"
                        value={customOrganizationId}
                        onChange={(e) => setCustomOrganizationId(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor="custom-apikey">
                      {customProviderType === 'netlify' ? 'Personal Access Token' :
                        customProviderType === 'cloudflare' ? 'API Token' :
                          customProviderType === 'deno' ? 'Access Token' :
                            customProviderType === 'railway' ? 'API Token' :
                              'Access Token'} <span className="text-destructive">*</span>
                    </Label>
                    <PasswordInput
                      id="custom-apikey"
                      placeholder={t('enterApiKey')}
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="custom-baseurl">Base URL (Optional)</Label>
                    <Input
                      id="custom-baseurl"
                      placeholder={
                        customProviderType === 'netlify'
                          ? 'https://api.netlify.com/api/v1'
                          : customProviderType === 'vercel'
                            ? 'https://api.vercel.com'
                            : customProviderType === 'deno'
                              ? 'https://api.deno.com/v1'
                              : customProviderType === 'railway'
                                ? 'https://backboard.railway.com'
                                : 'https://api.cloudflare.com/client/v4'
                      }
                      value={customBaseURL}
                      onChange={(e) => setCustomBaseURL(e.target.value)}
                    />
                  </div>
                  {(customProviderType === 'cloudflare' || customProviderType === 'deno') && (
                    <div className="grid gap-2">
                      <Label htmlFor="custom-basedomain">Base Domain (Optional)</Label>
                      <Input
                        id="custom-basedomain"
                        placeholder={customProviderType === 'cloudflare' ? 'workers.dev' : 'deno.dev'}
                        value={customBaseDomain}
                        onChange={(e) => setCustomBaseDomain(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        {customProviderType === 'cloudflare'
                          ? 'The domain suffix for deployed workers (e.g., workers.dev)'
                          : 'The domain suffix for deployed projects (e.g., deno.dev)'}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="custom-proxy"
                      checked={customProxy}
                      onCheckedChange={(checked) => setCustomProxy(checked === true)}
                    />
                    <Label htmlFor="custom-proxy" className="text-sm font-normal cursor-pointer">
                      Use CORS Proxy
                    </Label>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleAdd} disabled={!isValid}>
            <Check className="h-4 w-4 mr-2" />
            {t('add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
