import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Rocket, ArrowLeft, Trash2, Check, GripVertical } from 'lucide-react';
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
import { useDeploySettings } from '@/hooks/useDeploySettings';
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
    description: 'Deploy to Netlify with personal access token',
    apiKeyLabel: 'Personal Access Token',
    apiKeyURL: 'https://app.netlify.com/user/applications#personal-access-tokens',
  },
  {
    id: 'vercel',
    type: 'vercel',
    name: 'Vercel',
    description: 'Deploy to Vercel with access token',
    apiKeyLabel: 'Access Token',
    apiKeyURL: 'https://vercel.com/account/tokens',
  },
];

export function DeploySettings() {
  const { t } = useTranslation();
  const { settings, removeProvider, setProviders } = useDeploySettings();
  const { user } = useCurrentUser();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const [presetApiKeys, setPresetApiKeys] = useState<Record<string, string>>({});
  const [presetBaseURLs, setPresetBaseURLs] = useState<Record<string, string>>({});
  const [presetHosts, setPresetHosts] = useState<Record<string, string>>({});
  const [presetNames, setPresetNames] = useState<Record<string, string>>(() => {
    // Initialize with preset names
    const initialNames: Record<string, string> = {};
    PRESET_PROVIDERS.forEach(preset => {
      initialNames[preset.id] = preset.name;
    });
    return initialNames;
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = settings.providers.findIndex(p => p.name === active.id);
      const newIndex = settings.providers.findIndex(p => p.name === over.id);

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
    const baseURL = presetBaseURLs[preset.id];
    const host = presetHosts[preset.id];
    const customName = presetNames[preset.id];

    // For non-Shakespeare providers, require API key
    if (!preset.requiresNostr && !apiKey?.trim()) {
      return;
    }

    const finalName = customName?.trim() || preset.name;

    let newProvider: DeployProvider;

    if (preset.type === 'shakespeare') {
      newProvider = {
        name: finalName,
        type: 'shakespeare',
        ...(host?.trim() && { host: host.trim() }),
      };
    } else if (preset.type === 'netlify') {
      newProvider = {
        name: finalName,
        type: 'netlify',
        apiKey: apiKey.trim(),
        ...(baseURL?.trim() && { baseURL: baseURL.trim() }),
      };
    } else {
      newProvider = {
        name: finalName,
        type: 'vercel',
        apiKey: apiKey.trim(),
        ...(baseURL?.trim() && { baseURL: baseURL.trim() }),
      };
    }

    setProviders([...settings.providers, newProvider]);

    // Clear inputs and reset name to preset default
    setPresetApiKeys(prev => ({ ...prev, [preset.id]: '' }));
    setPresetBaseURLs(prev => ({ ...prev, [preset.id]: '' }));
    setPresetHosts(prev => ({ ...prev, [preset.id]: '' }));
    setPresetNames(prev => ({ ...prev, [preset.id]: preset.name }));
  };

  const handleRemoveProvider = (index: number) => {
    removeProvider(index);
  };

  const handleUpdateProvider = (index: number, provider: DeployProvider) => {
    const newProviders = [...settings.providers];
    newProviders[index] = provider;
    setProviders(newProviders);
  };

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
        <div className="space-y-3">
          <h4 className="text-sm font-medium">{t('addProvider')}</h4>
          <Accordion type="multiple" className="w-full space-y-2">
            {PRESET_PROVIDERS.map((preset) => {
                const isNostrPreset = preset.requiresNostr;
                const isLoggedIntoNostr = !!user;
                const showNostrLoginRequired = isNostrPreset && !isLoggedIntoNostr;

                return (
                  <AccordionItem key={preset.id} value={preset.id} className="border rounded-lg">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center justify-between w-full mr-3">
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-medium">{preset.name}</span>
                          <span className="text-xs text-muted-foreground font-normal">
                            {preset.description}
                          </span>
                        </div>
                        {preset.apiKeyURL && (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground underline hover:text-foreground whitespace-nowrap ml-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(preset.apiKeyURL, '_blank');
                            }}
                          >
                            {t('getApiKey')}
                          </button>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
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
                      ) : (
                        <div className="space-y-3">
                          <div className="grid gap-2">
                            <Label htmlFor={`preset-${preset.id}-name`}>
                              Name
                            </Label>
                            <Input
                              id={`preset-${preset.id}-name`}
                              placeholder="Provider name"
                              value={presetNames[preset.id] || preset.name}
                              onChange={(e) => setPresetNames(prev => ({
                                ...prev,
                                [preset.id]: e.target.value,
                              }))}
                            />
                          </div>

                          {!preset.requiresNostr && (
                            <div className="grid gap-2">
                              <Label htmlFor={`preset-${preset.id}-apiKey`}>
                                {preset.apiKeyLabel || t('apiKey')}
                              </Label>
                              <PasswordInput
                                id={`preset-${preset.id}-apiKey`}
                                placeholder={t('enterApiKey')}
                                value={presetApiKeys[preset.id] || ''}
                                onChange={(e) => setPresetApiKeys(prev => ({
                                  ...prev,
                                  [preset.id]: e.target.value,
                                }))}
                              />
                            </div>
                          )}

                          {preset.type === 'shakespeare' ? (
                            <div className="grid gap-2">
                              <Label htmlFor={`preset-${preset.id}-host`}>
                                Host (Optional)
                              </Label>
                              <Input
                                id={`preset-${preset.id}-host`}
                                placeholder="shakespeare.wtf"
                                value={presetHosts[preset.id] || ''}
                                onChange={(e) => setPresetHosts(prev => ({
                                  ...prev,
                                  [preset.id]: e.target.value,
                                }))}
                              />
                            </div>
                          ) : (
                            <div className="grid gap-2">
                              <Label htmlFor={`preset-${preset.id}-baseURL`}>
                                Base URL (Optional)
                              </Label>
                              <Input
                                id={`preset-${preset.id}-baseURL`}
                                placeholder={
                                  preset.type === 'netlify' ? 'https://api.netlify.com/api/v1' :
                                  'https://api.vercel.com'
                                }
                                value={presetBaseURLs[preset.id] || ''}
                                onChange={(e) => setPresetBaseURLs(prev => ({
                                  ...prev,
                                  [preset.id]: e.target.value,
                                }))}
                              />
                            </div>
                          )}

                          <Button
                            onClick={() => handleAddPresetProvider(preset)}
                            disabled={
                              (preset.requiresNostr && !isLoggedIntoNostr) ||
                              (!preset.requiresNostr && !presetApiKeys[preset.id]?.trim())
                            }
                            className="w-full gap-2"
                          >
                            <Check className="h-4 w-4" />
                            {t('add')}
                          </Button>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
      </div>
    </div>
  );
}

export default DeploySettings;
