import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Rocket, ArrowLeft, Trash2, Check, GripVertical } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDeploySettings } from '@/hooks/useDeploySettings';
import { useNetlifyOAuth } from '@/hooks/useNetlifyOAuth';
import { useVercelOAuth } from '@/hooks/useVercelOAuth';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useNavigate, Link } from 'react-router-dom';
import type { DeployProvider } from '@/contexts/DeploySettingsContext';

interface PresetProvider {
  id: string;
  type: 'shakespeare' | 'netlify' | 'vercel';
  name: string;
  description: string;
  requiresNostr?: boolean;
  apiKeyLabel?: string;
  apiKeyURL?: string;
  proxy?: boolean;
  supportsOAuth?: boolean;
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
      className="border rounded-lg"
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
          <span className="font-medium">
            {provider.name}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor={`provider-${index}-name`}>Name</Label>
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
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor={`provider-${index}-apiKey`}>
                  {preset?.apiKeyLabel || t('apiKey')}
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
                  placeholder={provider.type === 'netlify' ? 'https://api.netlify.com/api/v1' : 'https://api.vercel.com'}
                  value={provider.baseURL || ''}
                  onChange={(e) => {
                    if (provider.type === 'netlify') {
                      onUpdate(index, { ...provider, baseURL: e.target.value });
                    } else if (provider.type === 'vercel') {
                      onUpdate(index, { ...provider, baseURL: e.target.value });
                    }
                  }}
                />
              </div>
            </>
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
    id: 'netlify',
    type: 'netlify',
    name: 'Netlify',
    description: 'Deploy to Netlify',
    apiKeyLabel: 'Personal Access Token',
    apiKeyURL: 'https://app.netlify.com/user/applications#personal-access-tokens',
    proxy: true,
    supportsOAuth: true,
  },
  {
    id: 'vercel',
    type: 'vercel',
    name: 'Vercel',
    description: 'Deploy to Vercel',
    apiKeyLabel: 'Access Token',
    apiKeyURL: 'https://vercel.com/account/tokens',
    proxy: true,
    supportsOAuth: true,
  },
];

export function DeploySettings() {
  const { t } = useTranslation();
  const { settings, removeProvider, setProviders } = useDeploySettings();
  const { user } = useCurrentUser();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // OAuth hooks
  const netlifyOAuth = useNetlifyOAuth();
  const vercelOAuth = useVercelOAuth();

  const [presetApiKeys, setPresetApiKeys] = useState<Record<string, string>>({});

  // Custom provider form state
  const [customProviderType, setCustomProviderType] = useState<'shakespeare' | 'netlify' | 'vercel' | ''>('');
  const [customName, setCustomName] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customBaseURL, setCustomBaseURL] = useState('');
  const [customHost, setCustomHost] = useState('');
  const [customProxy, setCustomProxy] = useState(false);

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

    // For non-Shakespeare providers, require API key
    if (!preset.requiresNostr && !apiKey?.trim()) {
      return;
    }

    let newProvider: DeployProvider;

    if (preset.type === 'shakespeare') {
      newProvider = {
        id: crypto.randomUUID(),
        name: preset.name,
        type: 'shakespeare',
        ...(preset.proxy && { proxy: true }),
      };
    } else if (preset.type === 'netlify') {
      newProvider = {
        id: crypto.randomUUID(),
        name: preset.name,
        type: 'netlify',
        apiKey: apiKey.trim(),
        ...(preset.proxy && { proxy: true }),
      };
    } else {
      newProvider = {
        id: crypto.randomUUID(),
        name: preset.name,
        type: 'vercel',
        apiKey: apiKey.trim(),
        ...(preset.proxy && { proxy: true }),
      };
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
        id: crypto.randomUUID(),
        name: customName.trim(),
        type: 'shakespeare',
        ...(customHost?.trim() && { host: customHost.trim() }),
        ...(customProxy && { proxy: true }),
      };
    } else if (customProviderType === 'netlify') {
      if (!customApiKey.trim()) return;
      newProvider = {
        id: crypto.randomUUID(),
        name: customName.trim(),
        type: 'netlify',
        apiKey: customApiKey.trim(),
        ...(customBaseURL?.trim() && { baseURL: customBaseURL.trim() }),
        ...(customProxy && { proxy: true }),
      };
    } else {
      if (!customApiKey.trim()) return;
      newProvider = {
        id: crypto.randomUUID(),
        name: customName.trim(),
        type: 'vercel',
        apiKey: customApiKey.trim(),
        ...(customBaseURL?.trim() && { baseURL: customBaseURL.trim() }),
        ...(customProxy && { proxy: true }),
      };
    }

    setProviders([...settings.providers, newProvider]);

    // Clear form
    setCustomProviderType('');
    setCustomName('');
    setCustomApiKey('');
    setCustomBaseURL('');
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

  const configuredProviderTypes = settings.providers.map(p => p.type);
  const availablePresets = PRESET_PROVIDERS.filter(preset => !configuredProviderTypes.includes(preset.type));

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
              {t('deploySettingsDescriptionLong')}
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
            {t('deploySettingsDescriptionLong')}
          </p>
        </div>
      )}

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
                  <div key={preset.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium">{preset.name}</h5>
                      {preset.apiKeyURL && !isOAuthConfigured && (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline hover:text-foreground"
                          onClick={() => window.open(preset.apiKeyURL, '_blank')}
                        >
                          {t('getApiKey')}
                        </button>
                      )}
                    </div>

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
                    ) : preset.supportsOAuth && isOAuthConfigured ? (
                      // Show OAuth button if OAuth is configured
                      <div className="space-y-3">
                        <Button
                          onClick={() => oauthHook?.initiateOAuth()}
                          disabled={isOAuthLoading}
                          className="w-full max-w-full gap-2"
                          variant="default"
                        >
                          {isOAuthLoading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Connecting...
                            </>
                          ) : (
                            <>
                              {preset.type === 'netlify' && (
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M16.934 8.519a1.044 1.044 0 0 1 .303.23l2.349 2.348a1 1 0 0 1 0 1.414l-2.348 2.349a1.044 1.044 0 0 1-.231.303 1.042 1.042 0 0 1-1.473-1.473l.527-.527H11a1 1 0 1 1 0-2h5.061l-.527-.527a1.042 1.042 0 0 1 1.4-1.517zM7.066 15.481a1.044 1.044 0 0 1-.303-.23l-2.349-2.348a1 1 0 0 1 0-1.414l2.348-2.349a1.044 1.044 0 0 1 .231-.303 1.042 1.042 0 0 1 1.473 1.473l-.527.527H13a1 1 0 0 1 0 2H7.939l.527.527a1.042 1.042 0 0 1-1.4 1.517z" />
                                </svg>
                              )}
                              {preset.type === 'vercel' && (
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 1.5L24 22.5H0L12 1.5z" />
                                </svg>
                              )}
                              <span className="truncate text-ellipsis overflow-hidden">
                                Connect to {preset.name}
                              </span>
                            </>
                          )}
                        </Button>
                        {oauthError && (
                          <p className="text-sm text-destructive">
                            {oauthError}
                          </p>
                        )}
                      </div>
                    ) : (
                      // Show manual token input
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          {!preset.requiresNostr && (
                            <PasswordInput
                              placeholder={preset.apiKeyLabel || t('enterApiKey')}
                              className="flex-1"
                              value={presetApiKeys[preset.id] || ''}
                              onChange={(e) => setPresetApiKeys(prev => ({
                                ...prev,
                                [preset.id]: e.target.value,
                              }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && presetApiKeys[preset.id]?.trim()) {
                                  handleAddPresetProvider(preset);
                                }
                              }}
                            />
                          )}
                          <Button
                            onClick={() => handleAddPresetProvider(preset)}
                            disabled={
                              (preset.requiresNostr && !isLoggedIntoNostr) ||
                              (!preset.requiresNostr && !presetApiKeys[preset.id]?.trim())
                            }
                            className={preset.requiresNostr ? "w-full" : "h-10 px-4 ml-auto"}
                          >
                            {t('add')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Custom Provider */}
        <div className="space-y-3">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="custom-provider" className="border rounded-lg">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <h4 className="text-sm font-medium">{t('addCustomProvider')}</h4>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3">
                  <div className="grid gap-2">
                    <Label htmlFor="custom-provider-type">{t('providerType')}</Label>
                    <Select
                      value={customProviderType}
                      onValueChange={(value: 'shakespeare' | 'netlify' | 'vercel') => {
                        setCustomProviderType(value);
                        // Reset form when provider type changes
                        setCustomApiKey('');
                        setCustomBaseURL('');
                        setCustomHost('');
                        setCustomProxy(false);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('selectProviderType')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="shakespeare">Shakespeare Deploy</SelectItem>
                        <SelectItem value="netlify">Netlify</SelectItem>
                        <SelectItem value="vercel">Vercel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {customProviderType && (
                    <>
                      <div className="grid gap-2">
                        <Label htmlFor="custom-name">{t('providerName')}</Label>
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
                      ) : (
                        <>
                          <div className="grid gap-2">
                            <Label htmlFor="custom-apikey">
                              {customProviderType === 'netlify' ? 'Personal Access Token' : 'Access Token'}
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
                                  : 'https://api.vercel.com'
                              }
                              value={customBaseURL}
                              onChange={(e) => setCustomBaseURL(e.target.value)}
                            />
                          </div>
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
                          (customProviderType !== 'shakespeare' && !customApiKey.trim())
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
    </div>
  );
}

export default DeploySettings;
