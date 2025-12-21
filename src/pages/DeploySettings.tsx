import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Rocket, ArrowLeft, Trash2, Check, GripVertical, ChevronDown, Plus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { ExternalInput } from '@/components/ui/external-input';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeploySettings } from '@/hooks/useDeploySettings';
import { useNetlifyOAuth } from '@/hooks/useNetlifyOAuth';
import { useVercelOAuth } from '@/hooks/useVercelOAuth';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useNavigate, Link } from 'react-router-dom';
import type { DeployProvider } from '@/contexts/DeploySettingsContext';
import { ExternalFavicon } from '@/components/ExternalFavicon';
import { normalizeUrl } from '@/lib/faviconUrl';

interface PresetProvider {
  id: string;
  type: 'shakespeare' | 'netlify' | 'vercel' | 'nsite' | 'cloudflare' | 'deno';
  name: string;
  description: string;
  requiresNostr?: boolean;
  apiKeyLabel?: string;
  apiKeyURL?: string;
  accountIdLabel?: string;
  accountIdURL?: string;
  organizationIdLabel?: string;
  organizationIdURL?: string;
  proxy?: boolean;
}

interface SortableProviderItemProps {
  provider: DeployProvider;
  index: number;
  preset?: PresetProvider;
  onRemove: (index: number) => void;
  onUpdate: (index: number, provider: DeployProvider) => void;
  showDragHandle: boolean;
}

function SortableProviderItem({ provider, index, preset, onRemove, onUpdate, showDragHandle }: SortableProviderItemProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: index });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <AccordionItem
      ref={setNodeRef}
      style={style}
      value={String(index)}
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex items-center gap-2">
          {showDragHandle && (
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground hover:text-foreground"
            >
              <GripVertical className="h-4 w-4" />
            </div>
          )}
          {(() => {
            const url = getProviderUrl(provider);
            return url ? (
              <ExternalFavicon
                url={url}
                size={16}
                fallback={<Rocket size={16} />}
              />
            ) : (
              <Rocket size={16} />
            );
          })()}
          <span className="font-medium">
            {provider.name}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor={`provider-${index}-name`}>
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`provider-${index}-name`}
              placeholder="Provider name"
              value={provider.name}
              onChange={(e) => onUpdate(index, { ...provider, name: e.target.value })}
            />
          </div>
          {provider.type === 'shakespeare' ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t('shakespeareDeployNostrAuth')}
              </p>
              <div className="grid gap-2">
                <Label htmlFor={`provider-${index}-host`}>
                  Host (Optional)
                </Label>
                <Input
                  id={`provider-${index}-host`}
                  placeholder="shakespeare.wtf"
                  value={provider.host || ''}
                  onChange={(e) => onUpdate(index, { ...provider, host: e.target.value })}
                />
              </div>
            </>
          ) : provider.type === 'nsite' ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor={`provider-${index}-gateway`}>
                  Gateway <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`provider-${index}-gateway`}
                  placeholder="nsite.lol"
                  value={provider.gateway || ''}
                  onChange={(e) => onUpdate(index, { ...provider, gateway: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`provider-${index}-relays`}>
                  Relay URLs (comma-separated) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`provider-${index}-relays`}
                  placeholder="wss://relay.nostr.band, wss://relay.damus.io"
                  value={provider.relayUrls?.join(', ') || ''}
                  onChange={(e) => onUpdate(index, {
                    ...provider,
                    relayUrls: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`provider-${index}-blossom`}>
                  Blossom Servers (comma-separated) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`provider-${index}-blossom`}
                  placeholder="https://blossom.primal.net/"
                  value={provider.blossomServers?.join(', ') || ''}
                  onChange={(e) => onUpdate(index, {
                    ...provider,
                    blossomServers: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  })}
                />
              </div>
            </>
          ) : (
            <>
              {provider.type === 'cloudflare' && (
                <div className="grid gap-2">
                  <Label htmlFor={`provider-${index}-accountId`}>
                    {preset?.accountIdLabel || 'Account ID'} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={`provider-${index}-accountId`}
                    placeholder="Enter Account ID"
                    value={provider.accountId}
                    onChange={(e) => onUpdate(index, { ...provider, accountId: e.target.value })}
                  />
                </div>
              )}
              {provider.type === 'deno' && (
                <div className="grid gap-2">
                  <Label htmlFor={`provider-${index}-organizationId`}>
                    {preset?.organizationIdLabel || 'Organization ID'} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={`provider-${index}-organizationId`}
                    placeholder="Enter Organization ID"
                    value={provider.organizationId}
                    onChange={(e) => onUpdate(index, { ...provider, organizationId: e.target.value })}
                  />
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor={`provider-${index}-apiKey`}>
                  {preset?.apiKeyLabel || t('apiKey')} <span className="text-destructive">*</span>
                </Label>
                <PasswordInput
                  id={`provider-${index}-apiKey`}
                  placeholder={t('enterApiKey')}
                  value={provider.apiKey}
                  onChange={(e) => {
                    if (provider.type === 'netlify') {
                      onUpdate(index, { ...provider, apiKey: e.target.value });
                    } else if (provider.type === 'vercel') {
                      onUpdate(index, { ...provider, apiKey: e.target.value });
                    } else if (provider.type === 'cloudflare') {
                      onUpdate(index, { ...provider, apiKey: e.target.value });
                    } else if (provider.type === 'deno') {
                      onUpdate(index, { ...provider, apiKey: e.target.value });
                    }
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`provider-${index}-baseURL`}>
                  Base URL (Optional)
                </Label>
                <Input
                  id={`provider-${index}-baseURL`}
                  placeholder={
                    provider.type === 'netlify' ? 'https://api.netlify.com/api/v1' :
                      provider.type === 'vercel' ? 'https://api.vercel.com' :
                        provider.type === 'cloudflare' ? 'https://api.cloudflare.com/client/v4' :
                          provider.type === 'deno' ? 'https://api.deno.com/v1' :
                            'Base URL'
                  }
                  value={provider.baseURL || ''}
                  onChange={(e) => {
                    if (provider.type === 'netlify') {
                      onUpdate(index, { ...provider, baseURL: e.target.value });
                    } else if (provider.type === 'vercel') {
                      onUpdate(index, { ...provider, baseURL: e.target.value });
                    } else if (provider.type === 'cloudflare') {
                      onUpdate(index, { ...provider, baseURL: e.target.value });
                    } else if (provider.type === 'deno') {
                      onUpdate(index, { ...provider, baseURL: e.target.value });
                    }
                  }}
                />
              </div>
              {(provider.type === 'cloudflare' || provider.type === 'deno') && (
                <div className="grid gap-2">
                  <Label htmlFor={`provider-${index}-baseDomain`}>
                    Base Domain (Optional)
                  </Label>
                  <Input
                    id={`provider-${index}-baseDomain`}
                    placeholder={provider.type === 'cloudflare' ? 'workers.dev' : 'deno.dev'}
                    value={provider.baseDomain || ''}
                    onChange={(e) => onUpdate(index, { ...provider, baseDomain: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {provider.type === 'cloudflare'
                      ? 'The domain suffix for deployed workers (e.g., workers.dev)'
                      : 'The domain suffix for deployed projects (e.g., deno.dev)'}
                  </p>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`provider-${index}-proxy`}
                  checked={provider.proxy || false}
                  onCheckedChange={(checked) => onUpdate(index, { ...provider, proxy: checked === true })}
                />
                <Label
                  htmlFor={`provider-${index}-proxy`}
                  className="text-sm font-normal cursor-pointer"
                >
                  Use CORS Proxy
                </Label>
              </div>
            </>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onRemove(index)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('delete')}
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

const PRESET_PROVIDERS: PresetProvider[] = [
  {
    id: 'shakespeare',
    type: 'shakespeare',
    name: 'Shakespeare Deploy',
    description: 'Deploy to Shakespeare hosting with Nostr authentication',
    requiresNostr: true,
  },
  {
    id: 'nsite',
    type: 'nsite',
    name: 'nsite',
    description: 'Deploy to Nostr as a static website',
  },
  {
    id: 'netlify',
    type: 'netlify',
    name: 'Netlify',
    description: 'Deploy to Netlify',
    apiKeyLabel: 'Personal Access Token',
    apiKeyURL: 'https://app.netlify.com/user/applications#personal-access-tokens',
    proxy: true,
  },
  {
    id: 'vercel',
    type: 'vercel',
    name: 'Vercel',
    description: 'Deploy to Vercel',
    apiKeyLabel: 'Access Token',
    apiKeyURL: 'https://vercel.com/account/tokens',
    proxy: true,
  },
  {
    id: 'cloudflare',
    type: 'cloudflare',
    name: 'Cloudflare',
    description: 'Deploy to Cloudflare Workers',
    apiKeyLabel: 'API Token',
    apiKeyURL: 'https://dash.cloudflare.com/profile/api-tokens',
    accountIdLabel: 'Account ID',
    accountIdURL: 'https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/',
    proxy: true,
  },
  {
    id: 'deno',
    type: 'deno',
    name: 'Deno Deploy',
    description: 'Deploy to Deno Deploy',
    apiKeyLabel: 'Access Token',
    apiKeyURL: 'https://dash.deno.com/account#access-tokens',
    organizationIdLabel: 'Organization ID',
    organizationIdURL: 'https://dash.deno.com/orgs',
    proxy: true,
  },
];

// Helper function to generate custom provider ID
function generateCustomProviderId(type: string): string {
  const uuid = crypto.randomUUID();
  const randomSegment = uuid.split('-')[0];
  return `${type}-${randomSegment}`;
}

function getProviderUrl(provider: DeployProvider | PresetProvider): string | null {
  switch (provider.type) {
    case 'shakespeare':
      // For Shakespeare providers, check for custom host first, then use default
      if ('host' in provider && provider.host) {
        return normalizeUrl(provider.host);
      }
      return 'https://shakespeare.diy';

    case 'netlify':
      // For Netlify providers, check for custom baseURL first, then use default
      if ('baseURL' in provider && provider.baseURL) {
        return provider.baseURL;
      }
      return 'https://netlify.com';

    case 'vercel':
      // For Vercel providers, check for custom baseURL first, then use default
      if ('baseURL' in provider && provider.baseURL) {
        return provider.baseURL;
      }
      return 'https://vercel.com';

    case 'cloudflare':
      // For Cloudflare providers, check for custom baseURL first, then use default
      if ('baseURL' in provider && provider.baseURL) {
        return provider.baseURL;
      }
      return 'https://cloudflare.com';

    case 'deno':
      // For Deno Deploy providers, check for custom baseURL first, then use default
      if ('baseURL' in provider && provider.baseURL) {
        return provider.baseURL;
      }
      return 'https://deno.com';

    case 'nsite':
      // nsite uses Rocket icon fallback
      return null;

    default:
      return null;
  }
}

export function DeploySettings() {
  const { t } = useTranslation();
  const { settings, removeProvider, setProviders, isInitialized } = useDeploySettings();
  const { user } = useCurrentUser();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // OAuth hooks
  const netlifyOAuth = useNetlifyOAuth();
  const vercelOAuth = useVercelOAuth();

  const [presetApiKeys, setPresetApiKeys] = useState<Record<string, string>>({});
  const [forceManualEntry, setForceManualEntry] = useState<Record<string, boolean>>({});

  // Custom provider form state
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = settings.providers.findIndex((_, i) => i === active.id);
      const newIndex = settings.providers.findIndex((_, i) => i === over.id);

      const newProviders = arrayMove(settings.providers, oldIndex, newIndex);
      setProviders(newProviders);
    }
  };

  const handleAddPresetProvider = (preset: PresetProvider) => {
    // For Shakespeare, just check if user is logged in
    if (preset.requiresNostr && !user) {
      return;
    }

    const apiKey = presetApiKeys[preset.id];

    // For non-Shakespeare/non-nsite providers, require API key
    if (!preset.requiresNostr && preset.type !== 'nsite' && !apiKey?.trim()) {
      return;
    }

    let newProvider: DeployProvider;

    if (preset.type === 'shakespeare') {
      newProvider = {
        id: preset.id, // Use preset ID for presets
        name: preset.name,
        type: 'shakespeare',
        ...(preset.proxy && { proxy: true }),
      };
    } else if (preset.type === 'nsite') {
      newProvider = {
        id: preset.id, // Use preset ID for presets
        name: preset.name,
        type: 'nsite',
        gateway: 'nosto.re',
        relayUrls: [
          'wss://relay.nsite.lol',
          'wss://relay.nosto.re',
          'wss://relay.nostr.band',
          'wss://relay.primal.net',
          'wss://relay.damus.io',
          'wss://purplerelay.com',
        ],
        blossomServers: [
          'https://blossom.primal.net',
          'https://cdn.sovbit.host',
        ],
      };
    } else if (preset.type === 'netlify') {
      newProvider = {
        id: preset.id, // Use preset ID for presets
        name: preset.name,
        type: 'netlify',
        apiKey: apiKey.trim(),
        ...(preset.proxy && { proxy: true }),
      };
    } else if (preset.type === 'vercel') {
      newProvider = {
        id: preset.id, // Use preset ID for presets
        name: preset.name,
        type: 'vercel',
        apiKey: apiKey.trim(),
        ...(preset.proxy && { proxy: true }),
      };
    } else if (preset.type === 'cloudflare') {
      const accountId = presetApiKeys[`${preset.id}-accountId`];
      if (!accountId?.trim()) {
        return;
      }
      newProvider = {
        id: preset.id, // Use preset ID for presets
        name: preset.name,
        type: 'cloudflare',
        apiKey: apiKey.trim(),
        accountId: accountId.trim(),
        ...(preset.proxy && { proxy: true }),
      };
    } else if (preset.type === 'deno') {
      const organizationId = presetApiKeys[`${preset.id}-organizationId`];
      if (!organizationId?.trim()) {
        return;
      }
      newProvider = {
        id: preset.id, // Use preset ID for presets
        name: preset.name,
        type: 'deno',
        apiKey: apiKey.trim(),
        organizationId: organizationId.trim(),
        ...(preset.proxy && { proxy: true }),
      };
    } else {
      return; // Unknown type
    }

    setProviders([...settings.providers, newProvider]);

    // Clear inputs
    setPresetApiKeys(prev => ({ ...prev, [preset.id]: '' }));
  };

  const handleAddCustomProvider = () => {
    if (!customProviderType || !customName.trim()) return;

    let newProvider: DeployProvider;

    if (customProviderType === 'shakespeare') {
      newProvider = {
        id: generateCustomProviderId(customProviderType), // Generate custom ID
        name: customName.trim(),
        type: 'shakespeare',
        ...(customHost?.trim() && { host: customHost.trim() }),
        ...(customProxy && { proxy: true }),
      };
    } else if (customProviderType === 'nsite') {
      const gateway = customGateway.trim() || 'nsite.lol';
      const relayUrls = customRelayUrls.trim()
        ? customRelayUrls.split(',').map(s => s.trim()).filter(Boolean)
        : ['wss://relay.nostr.band'];
      const blossomServers = customBlossomServers.trim()
        ? customBlossomServers.split(',').map(s => s.trim()).filter(Boolean)
        : ['https://blossom.primal.net/'];

      newProvider = {
        id: generateCustomProviderId(customProviderType), // Generate custom ID
        name: customName.trim(),
        type: 'nsite',
        gateway,
        relayUrls,
        blossomServers,
      };
    } else if (customProviderType === 'netlify') {
      if (!customApiKey.trim()) return;
      newProvider = {
        id: generateCustomProviderId(customProviderType), // Generate custom ID
        name: customName.trim(),
        type: 'netlify',
        apiKey: customApiKey.trim(),
        ...(customBaseURL?.trim() && { baseURL: customBaseURL.trim() }),
        ...(customProxy && { proxy: true }),
      };
    } else if (customProviderType === 'vercel') {
      if (!customApiKey.trim()) return;
      newProvider = {
        id: generateCustomProviderId(customProviderType), // Generate custom ID
        name: customName.trim(),
        type: 'vercel',
        apiKey: customApiKey.trim(),
        ...(customBaseURL?.trim() && { baseURL: customBaseURL.trim() }),
        ...(customProxy && { proxy: true }),
      };
    } else if (customProviderType === 'cloudflare') {
      if (!customApiKey.trim() || !customAccountId.trim()) return;
      newProvider = {
        id: generateCustomProviderId(customProviderType), // Generate custom ID
        name: customName.trim(),
        type: 'cloudflare',
        apiKey: customApiKey.trim(),
        accountId: customAccountId.trim(),
        ...(customBaseURL?.trim() && { baseURL: customBaseURL.trim() }),
        ...(customBaseDomain?.trim() && { baseDomain: customBaseDomain.trim() }),
        ...(customProxy && { proxy: true }),
      };
    } else if (customProviderType === 'deno') {
      if (!customApiKey.trim() || !customOrganizationId.trim()) return;
      newProvider = {
        id: generateCustomProviderId(customProviderType), // Generate custom ID
        name: customName.trim(),
        type: 'deno',
        apiKey: customApiKey.trim(),
        organizationId: customOrganizationId.trim(),
        ...(customBaseURL?.trim() && { baseURL: customBaseURL.trim() }),
        ...(customBaseDomain?.trim() && { baseDomain: customBaseDomain.trim() }),
        ...(customProxy && { proxy: true }),
      };
    } else {
      return; // Unknown type
    }

    setProviders([...settings.providers, newProvider]);

    // Clear form
    setCustomProviderType('');
    setCustomName('');
    setCustomApiKey('');
    setCustomAccountId('');
    setCustomOrganizationId('');
    setCustomBaseURL('');
    setCustomBaseDomain('');
    setCustomHost('');
    setCustomProxy(false);
  };

  const handleRemoveProvider = (index: number) => {
    removeProvider(index);
  };

  const handleUpdateProvider = (index: number, provider: DeployProvider) => {
    const newProviders = [...settings.providers];
    newProviders[index] = provider;
    setProviders(newProviders);
  };

  const configuredProviderIds = settings.providers.map(p => p.id);
  const availablePresets = PRESET_PROVIDERS.filter(preset => !configuredProviderIds.includes(preset.id));

  return (
    <div className="p-6 space-y-6">
      {isMobile && (
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/settings')}
            className="h-8 w-auto px-2 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToSettings')}
          </Button>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Rocket className="h-6 w-6 text-primary" />
              {t('deploySettings')}
            </h1>
            <p className="text-muted-foreground">
              {t('deploySettingsDescription')}
            </p>
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="space-y-2">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Rocket className="h-6 w-6 text-primary" />
            {t('deploySettings')}
          </h1>
          <p className="text-muted-foreground">
            {t('deploySettingsDescription')}
          </p>
        </div>
      )}

      {!isInitialized ? (
        <div className="space-y-6">
          {/* Loading skeleton for configured providers */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          </div>

          {/* Loading skeleton for add provider section */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-3">
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-40 w-full rounded-lg" />
            </div>
          </div>

          {/* Loading skeleton for custom provider */}
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Configured Providers */}
          {settings.providers.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">{t('configuredProviders')}</h4>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={settings.providers.map((_, index) => index)}
                  strategy={verticalListSortingStrategy}
                >
                  <Accordion type="multiple" className="w-full space-y-2">
                    {settings.providers.map((provider, index) => {
                      const preset = PRESET_PROVIDERS.find(p => p.type === provider.type);

                      return (
                        <SortableProviderItem
                          key={index}
                          provider={provider}
                          index={index}
                          preset={preset}
                          onRemove={handleRemoveProvider}
                          onUpdate={handleUpdateProvider}
                          showDragHandle={settings.providers.length > 1}
                        />
                      );
                    })}
                  </Accordion>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* Available Preset Providers */}
          {availablePresets.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">{t('addProvider')}</h4>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-3">
                {availablePresets.map((preset) => {
                  const isNostrPreset = preset.requiresNostr;
                  const isLoggedIntoNostr = !!user;
                  const showNostrLoginRequired = isNostrPreset && !isLoggedIntoNostr;

                  // Get OAuth hook for this preset
                  const oauthHook = preset.type === 'netlify' ? netlifyOAuth :
                    preset.type === 'vercel' ? vercelOAuth : null;
                  const isOAuthConfigured = oauthHook?.isOAuthConfigured ?? false;
                  const isOAuthLoading = oauthHook?.isLoading ?? false;
                  const oauthError = oauthHook?.error ?? null;

                  return (
                    <Card key={preset.id}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const url = getProviderUrl(preset);
                            return url ? (
                              <ExternalFavicon
                                url={url}
                                size={16}
                                fallback={<Rocket size={16} />}
                              />
                            ) : (
                              <Rocket size={16} />
                            );
                          })()}
                          <h5 className="font-medium">{preset.name}</h5>
                        </div>
                        <p className="text-sm text-muted-foreground">{preset.description}</p>

                        {showNostrLoginRequired ? (
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                              {t('loginToNostrRequired')}
                            </p>
                            <Button asChild className="w-full">
                              <Link to="/settings/nostr">
                                {t('goToNostrSettings')}
                              </Link>
                            </Button>
                          </div>
                        ) : isOAuthConfigured && !forceManualEntry[preset.id] ? (
                        // Show OAuth button if OAuth is configured and not forced to manual
                          <div className="space-y-3">
                            <div className="flex gap-0">
                              <Button
                                onClick={() => oauthHook?.initiateOAuth()}
                                disabled={isOAuthLoading}
                                className="flex-1 rounded-r-none gap-2"
                                variant="default"
                              >
                                {isOAuthLoading ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  Connecting...
                                  </>
                                ) : (
                                  <>
                                    {(() => {
                                      const url = getProviderUrl(preset);
                                      return url ? (
                                        <ExternalFavicon
                                          url={url}
                                          size={16}
                                          fallback={<Rocket size={16} />}
                                        />
                                      ) : (
                                        <Rocket size={16} />
                                      );
                                    })()}
                                    <span className="truncate text-ellipsis overflow-hidden">
                                    Connect to {preset.name}
                                    </span>
                                  </>
                                )}
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="default"
                                    className="rounded-l-none border-l border-primary-foreground/20 px-2"
                                    disabled={isOAuthLoading}
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => setForceManualEntry(prev => ({ ...prev, [preset.id]: true }))}
                                  >
                                  Enter API key
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            {oauthError && (
                              <p className="text-sm text-destructive">
                                {oauthError}
                              </p>
                            )}
                          </div>
                        ) : (
                        // Show manual token input
                          <div className="space-y-2">
                            {!preset.requiresNostr && preset.type !== 'nsite' && (
                              <>
                                {preset.type === 'cloudflare' && (
                                  <ExternalInput
                                    type="text"
                                    placeholder={preset.accountIdLabel || 'Account ID'}
                                    value={presetApiKeys[`${preset.id}-accountId`] || ''}
                                    onChange={(e) => setPresetApiKeys(prev => ({
                                      ...prev,
                                      [`${preset.id}-accountId`]: e.target.value,
                                    }))}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && presetApiKeys[preset.id]?.trim() &&
                                        presetApiKeys[`${preset.id}-accountId`]?.trim()) {
                                        handleAddPresetProvider(preset);
                                      }
                                    }}
                                    url={preset.accountIdURL}
                                    urlTitle="Find ID"
                                  />
                                )}
                                {preset.type === 'deno' && (
                                  <ExternalInput
                                    type="text"
                                    placeholder={preset.organizationIdLabel || 'Organization ID'}
                                    value={presetApiKeys[`${preset.id}-organizationId`] || ''}
                                    onChange={(e) => setPresetApiKeys(prev => ({
                                      ...prev,
                                      [`${preset.id}-organizationId`]: e.target.value,
                                    }))}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && presetApiKeys[preset.id]?.trim() &&
                                        presetApiKeys[`${preset.id}-organizationId`]?.trim()) {
                                        handleAddPresetProvider(preset);
                                      }
                                    }}
                                    url={preset.organizationIdURL}
                                    urlTitle="Find ID"
                                  />
                                )}
                                <ExternalInput
                                  type="password"
                                  placeholder={preset.apiKeyLabel || t('enterApiKey')}
                                  value={presetApiKeys[preset.id] || ''}
                                  onChange={(e) => setPresetApiKeys(prev => ({
                                    ...prev,
                                    [preset.id]: e.target.value,
                                  }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && presetApiKeys[preset.id]?.trim() &&
                                      (preset.type !== 'cloudflare' || presetApiKeys[`${preset.id}-accountId`]?.trim()) &&
                                      (preset.type !== 'deno' || presetApiKeys[`${preset.id}-organizationId`]?.trim())) {
                                      handleAddPresetProvider(preset);
                                    }
                                  }}
                                  url={preset.apiKeyURL}
                                  urlTitle="Get Key"
                                />
                              </>
                            )}
                            <Button
                              onClick={() => handleAddPresetProvider(preset)}
                              disabled={
                                (preset.requiresNostr && !isLoggedIntoNostr) ||
                              (!preset.requiresNostr && preset.type !== 'nsite' && !presetApiKeys[preset.id]?.trim()) ||
                              (preset.type === 'cloudflare' && !presetApiKeys[`${preset.id}-accountId`]?.trim()) ||
                              (preset.type === 'deno' && !presetApiKeys[`${preset.id}-organizationId`]?.trim())
                              }
                              className="w-full"
                            >
                              {t('add')}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Provider */}
          <div className="space-y-3">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="custom-provider">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <h4 className="text-sm font-medium">{t('addCustomProvider')}</h4>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-3">
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
                          </>
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

                        <Button
                          onClick={handleAddCustomProvider}
                          disabled={
                            !customProviderType ||
                          !customName.trim() ||
                          (customProviderType !== 'shakespeare' && customProviderType !== 'nsite' && !customApiKey.trim()) ||
                          (customProviderType === 'cloudflare' && !customAccountId.trim()) ||
                          (customProviderType === 'deno' && !customOrganizationId.trim())
                          }
                          className="gap-2 ml-auto"
                        >
                          <Check className="h-4 w-4" />
                          {t('add')}
                        </Button>
                      </>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      )}
    </div>
  );
}

export default DeploySettings;
