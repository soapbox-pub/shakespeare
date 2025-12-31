import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Rocket, Plus } from 'lucide-react';
import { SettingsPageLayout } from '@/components/SettingsPageLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeploySettings } from '@/hooks/useDeploySettings';
import { useNetlifyOAuth } from '@/hooks/useNetlifyOAuth';
import { useVercelOAuth } from '@/hooks/useVercelOAuth';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { DeployProvider } from '@/contexts/DeploySettingsContext';
import { ExternalFavicon } from '@/components/ExternalFavicon';
import { ProviderConfigDialog } from '@/components/ProviderConfigDialog';
import { AddProviderDialog } from '@/components/AddProviderDialog';
import { AddCustomProviderDialog } from '@/components/AddCustomProviderDialog';

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

interface ProviderTileProps {
  provider: DeployProvider;
  preset?: PresetProvider;
  onClick: () => void;
}

function ProviderTile({ provider, onClick }: ProviderTileProps) {
  const url = getProviderUrl(provider);

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border bg-card hover:bg-muted transition-colors text-center min-h-[100px]"
    >
      {url ? (
        <ExternalFavicon
          url={url}
          size={32}
          fallback={<Rocket size={32} />}
        />
      ) : (
        <Rocket size={32} />
      )}
      <span className="text-sm font-medium line-clamp-2 overflow-hidden max-w-full text-ellipsis">
        {provider.name}
      </span>
    </button>
  );
}

interface AddProviderTileProps {
  onClick: () => void;
}

function AddProviderTile({ onClick }: AddProviderTileProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-dashed bg-card hover:bg-muted transition-colors text-center min-h-[100px]"
    >
      <Plus size={32} className="text-muted-foreground" />
      <span className="text-sm font-medium text-muted-foreground overflow-hidden max-w-full text-ellipsis">
        Add Custom
      </span>
    </button>
  );
}

interface PresetProviderTileProps {
  preset: PresetProvider;
  onClick: () => void;
}

function PresetProviderTile({ preset, onClick }: PresetProviderTileProps) {
  const url = getProviderUrl(preset);

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border bg-card hover:bg-muted transition-colors text-center min-h-[100px]"
    >
      {url ? (
        <ExternalFavicon
          url={url}
          size={32}
          fallback={<Rocket size={32} />}
        />
      ) : (
        <Rocket size={32} />
      )}
      <span className="text-sm font-medium line-clamp-2 overflow-hidden max-w-full text-ellipsis">
        {preset.name}
      </span>
    </button>
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

  // OAuth hooks
  const netlifyOAuth = useNetlifyOAuth();
  const vercelOAuth = useVercelOAuth();

  const [forceManualEntry, setForceManualEntry] = useState<Record<string, boolean>>({});

  // Dialog state
  const [selectedProviderIndex, setSelectedProviderIndex] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PresetProvider | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [customProviderDialogOpen, setCustomProviderDialogOpen] = useState(false);

  const handleOpenProviderDialog = (index: number) => {
    setSelectedProviderIndex(index);
    setDialogOpen(true);
  };

  const handleOpenAddDialog = (preset: PresetProvider) => {
    setSelectedPreset(preset);
    setAddDialogOpen(true);
  };

  const handleAddPresetProvider = (preset: PresetProvider, apiKey: string, accountId?: string, organizationId?: string) => {
    // For Shakespeare, just check if user is logged in
    if (preset.requiresNostr && !user) {
      return;
    }

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
  };

  const handleAddCustomProvider = (provider: Omit<DeployProvider, 'id'>) => {
    const newProvider: DeployProvider = {
      id: generateCustomProviderId(provider.type),
      ...provider,
    } as DeployProvider;

    setProviders([...settings.providers, newProvider]);
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
    <SettingsPageLayout
      icon={Rocket}
      titleKey="deploySettings"
      descriptionKey="deploySettingsDescription"
    >
      {!isInitialized ? (
        <>
          {/* Loading skeleton for configured providers */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
              <Skeleton className="h-[120px] w-full rounded-lg" />
              <Skeleton className="h-[120px] w-full rounded-lg" />
            </div>
          </div>

          {/* Loading skeleton for add provider section */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
              <Skeleton className="h-[120px] w-full rounded-lg" />
              <Skeleton className="h-[120px] w-full rounded-lg" />
              <Skeleton className="h-[120px] w-full rounded-lg" />
              <Skeleton className="h-[120px] w-full rounded-lg" />
              <Skeleton className="h-[120px] w-full rounded-lg" />
              <Skeleton className="h-[120px] w-full rounded-lg" />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Configured Providers */}
          {settings.providers.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">{t('configuredProviders')}</h4>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
                {settings.providers.map((provider, index) => {
                  const preset = PRESET_PROVIDERS.find(p => p.type === provider.type);

                  return (
                    <ProviderTile
                      key={provider.id}
                      provider={provider}
                      preset={preset}
                      onClick={() => handleOpenProviderDialog(index)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Provider Config Dialog */}
          {selectedProviderIndex !== null && (
            <ProviderConfigDialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              provider={settings.providers[selectedProviderIndex]}
              preset={PRESET_PROVIDERS.find(p => p.type === settings.providers[selectedProviderIndex].type)}
              onUpdate={(updatedProvider) => handleUpdateProvider(selectedProviderIndex, updatedProvider)}
              onRemove={() => handleRemoveProvider(selectedProviderIndex)}
            />
          )}

          {/* Available Preset Providers */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">{t('addProvider')}</h4>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
              {availablePresets.map((preset) => (
                <PresetProviderTile
                  key={preset.id}
                  preset={preset}
                  onClick={() => handleOpenAddDialog(preset)}
                />
              ))}

              {/* Add Custom Provider Tile */}
              <AddProviderTile onClick={() => setCustomProviderDialogOpen(true)} />
            </div>

            {/* Add Preset Provider Dialog */}
            {selectedPreset && (
              <AddProviderDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
                preset={selectedPreset}
                isLoggedIntoNostr={!!user}
                oauthHook={
                  selectedPreset.type === 'netlify' ? netlifyOAuth :
                    selectedPreset.type === 'vercel' ? vercelOAuth : null
                }
                forceManualEntry={forceManualEntry[selectedPreset.id] || false}
                onSetForceManualEntry={(force) =>
                  setForceManualEntry(prev => ({ ...prev, [selectedPreset.id]: force }))
                }
                onAdd={(apiKey, accountId, organizationId) =>
                  handleAddPresetProvider(selectedPreset, apiKey, accountId, organizationId)
                }
              />
            )}

            {/* Add Custom Provider Dialog */}
            <AddCustomProviderDialog
              open={customProviderDialogOpen}
              onOpenChange={setCustomProviderDialogOpen}
              onAdd={handleAddCustomProvider}
            />
          </div>


        </>
      )}
    </SettingsPageLayout>
  );
}

export default DeploySettings;
