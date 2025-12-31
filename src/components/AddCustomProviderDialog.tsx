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

interface AddCustomProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (provider: {
    type: 'shakespeare' | 'netlify' | 'vercel' | 'nsite' | 'cloudflare' | 'deno';
    name: string;
    apiKey?: string;
    accountId?: string;
    organizationId?: string;
    baseURL?: string;
    baseDomain?: string;
    host?: string;
    proxy?: boolean;
    gateway?: string;
    relayUrls?: string[];
    blossomServers?: string[];
  }) => void;
}

export function AddCustomProviderDialog({
  open,
  onOpenChange,
  onAdd,
}: AddCustomProviderDialogProps) {
  const { t } = useTranslation();
  const [customProviderType, setCustomProviderType] = useState<'shakespeare' | 'netlify' | 'vercel' | 'nsite' | 'cloudflare' | 'deno' | ''>('');
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

    const provider: any = {
      type: customProviderType,
      name: customName.trim(),
    };

    if (customProviderType === 'shakespeare') {
      if (customHost?.trim()) provider.host = customHost.trim();
      if (customProxy) provider.proxy = true;
    } else if (customProviderType === 'nsite') {
      provider.gateway = customGateway.trim() || 'nsite.lol';
      provider.relayUrls = customRelayUrls.trim()
        ? customRelayUrls.split(',').map(s => s.trim()).filter(Boolean)
        : ['wss://relay.nostr.band'];
      provider.blossomServers = customBlossomServers.trim()
        ? customBlossomServers.split(',').map(s => s.trim()).filter(Boolean)
        : ['https://blossom.primal.net/'];
    } else {
      if (!customApiKey.trim()) return;
      provider.apiKey = customApiKey.trim();
      
      if (customProviderType === 'cloudflare') {
        if (!customAccountId.trim()) return;
        provider.accountId = customAccountId.trim();
      }
      
      if (customProviderType === 'deno') {
        if (!customOrganizationId.trim()) return;
        provider.organizationId = customOrganizationId.trim();
      }
      
      if (customBaseURL?.trim()) provider.baseURL = customBaseURL.trim();
      if (customBaseDomain?.trim()) provider.baseDomain = customBaseDomain.trim();
      if (customProxy) provider.proxy = true;
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
        (customProviderType !== 'deno' || customOrganizationId.trim())));

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
              onValueChange={(value: 'shakespeare' | 'netlify' | 'vercel' | 'nsite' | 'cloudflare' | 'deno') => {
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
