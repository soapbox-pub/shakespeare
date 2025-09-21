import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Bot, ArrowLeft, Trash2, GripVertical } from 'lucide-react';
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
import { CreditsBadge } from '@/components/CreditsBadge';
import { CreditsDialog } from '@/components/CreditsDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAISettings } from '@/hooks/useAISettings';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNavigate, Link } from 'react-router-dom';
import type { AIProvider } from '@/contexts/AISettingsContext';

interface PresetProvider {
  id: string;
  name: string;
  baseURL: string;
  apiKeysURL?: string;
  nostr?: boolean;
}

const PRESET_PROVIDERS: PresetProvider[] = [
  {
    id: "shakespeare",
    name: "Shakespeare AI",
    baseURL: "https://ai.shakespeare.diy/v1",
    nostr: true,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKeysURL: "https://openrouter.ai/settings/keys",
  },
  {
    id: "ppq",
    name: "PayPerQ",
    baseURL: "https://api.ppq.ai",
    apiKeysURL: "https://ppq.ai/api-docs",
  },
  {
    id: "routstr",
    name: "Routstr",
    baseURL: "https://api.routstr.com/v1",
    apiKeysURL: "https://chat.routstr.com/",
  },
  {
    id: "zai",
    name: "Z.ai",
    baseURL: "https://api.z.ai/api/paas/v4",
    apiKeysURL: "https://z.ai/manage-apikey/apikey-list",
  },
  {
    id: "openai",
    name: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    apiKeysURL: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    baseURL: "https://api.anthropic.com/v1",
    apiKeysURL: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "xai",
    name: "xAI",
    baseURL: "https://api.x.ai/v1",
    apiKeysURL: "https://console.x.ai",
  },
];

interface SortableProviderItemProps {
  provider: AIProvider;
  preset?: PresetProvider;
  onRemove: (id: string) => void;
  onSetProvider: (provider: AIProvider) => void;
  onOpenCreditsDialog: (providerId: string) => void;
  showDragHandle: boolean;
}

function SortableProviderItem({ provider, preset, onRemove, onSetProvider, onOpenCreditsDialog, showDragHandle }: SortableProviderItemProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: provider.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <AccordionItem
      ref={setNodeRef}
      style={style}
      value={provider.id}
      className="border rounded-lg"
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex items-center justify-between w-full mr-3">
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
              {preset?.name || provider.id}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CreditsBadge
              providerId={provider.id}
              connection={{ baseURL: provider.baseURL, apiKey: provider.apiKey, nostr: provider.nostr }}
              onOpenDialog={() => onOpenCreditsDialog(provider.id)}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(provider.id);
              }}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-transparent"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor={`${provider.id}-baseURL`}>{t('baseUrl')}</Label>
            <Input
              id={`${provider.id}-baseURL`}
              placeholder="https://api.example.com/v1"
              value={provider.baseURL || ''}
              onChange={(e) => onSetProvider({ ...provider, baseURL: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${provider.id}-auth`}>{t('authentication')}</Label>
            <Select
              value={provider.nostr ? 'nostr' : 'api-key'}
              onValueChange={(value: 'api-key' | 'nostr') => onSetProvider({
                ...provider,
                nostr: value === 'nostr' || undefined,
                apiKey: value === 'nostr' ? undefined : provider.apiKey
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="api-key">{t('apiKey')}</SelectItem>
                <SelectItem value="nostr">Nostr</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!provider.nostr && (
            <div className="grid gap-2">
              <Label htmlFor={`${provider.id}-apiKey`}>{t('apiKey')}</Label>
              <PasswordInput
                id={`${provider.id}-apiKey`}
                placeholder={t('enterApiKey')}
                value={provider.apiKey || ''}
                onChange={(e) => onSetProvider({ ...provider, apiKey: e.target.value })}
              />
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function AISettings() {
  const { t } = useTranslation();
  const { settings, setProvider, removeProvider, setProviders } = useAISettings();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [customProviderName, setCustomProviderName] = useState('');
  const [customBaseURL, setCustomBaseURL] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customAuthMethod, setCustomAuthMethod] = useState<'api-key' | 'nostr'>('api-key');
  const [presetApiKeys, setPresetApiKeys] = useState<Record<string, string>>({});
  const [activeCreditsDialog, setActiveCreditsDialog] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAddPresetProvider = (preset: PresetProvider) => {
    const apiKey = presetApiKeys[preset.id] as string | undefined;

    const newProvider: AIProvider = {
      id: preset.id,
      baseURL: preset.baseURL,
    };

    if (typeof apiKey === 'string') {
      newProvider.apiKey = apiKey.trim();
    }
    if (typeof preset.nostr === 'boolean') {
      newProvider.nostr = preset.nostr;
    }

    // Auto-save: Add provider immediately to persistent storage
    setProvider(newProvider);

    // Clear the API key input for this preset
    setPresetApiKeys(prev => ({
      ...prev,
      [preset.id]: '',
    }));
  };

  const handleAddCustomProvider = () => {
    if (!customProviderName.trim() || !customBaseURL.trim()) return;

    const newProvider: AIProvider = {
      id: customProviderName.trim(),
      baseURL: customBaseURL.trim(),
      apiKey: customAuthMethod === 'nostr' ? undefined : customApiKey.trim(),
      nostr: customAuthMethod === 'nostr' || undefined,
    };

    // Auto-save: Add provider immediately to persistent storage
    setProvider(newProvider);

    setCustomProviderName('');
    setCustomBaseURL('');
    setCustomApiKey('');
    setCustomAuthMethod('api-key');
  };

  const handleRemoveProvider = (id: string) => {
    // Auto-save: Remove provider immediately from persistent storage
    removeProvider(id);
  };

  const handleSetProvider = (provider: AIProvider) => {
    // Auto-save: Update provider immediately in persistent storage
    setProvider(provider);
  };

  const handleOpenCreditsDialog = (providerId: string) => {
    setActiveCreditsDialog(providerId);
  };

  const handleCloseCreditsDialog = () => {
    setActiveCreditsDialog(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = settings.providers.findIndex(provider => provider.id === active.id);
      const newIndex = settings.providers.findIndex(provider => provider.id === over?.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newProviders = arrayMove(settings.providers, oldIndex, newIndex);
        setProviders(newProviders);
      }
    }
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
              <Bot className="h-6 w-6 text-primary" />
              {t('aiSettings')}
            </h1>
            <p className="text-muted-foreground">
              {t('aiSettingsDescriptionLong')}
            </p>
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="space-y-2">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Bot className="h-6 w-6 text-primary" />
            {t('aiSettings')}
          </h1>
          <p className="text-muted-foreground">
            {t('aiSettingsDescriptionLong')}
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
                items={settings.providers.map(p => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <Accordion type="multiple" className="w-full space-y-2">
                  {settings.providers.map((provider) => {
                    const preset = PRESET_PROVIDERS.find(p => p.id === provider.id);

                    return (
                      <SortableProviderItem
                        key={provider.id}
                        provider={provider}
                        preset={preset}
                        onRemove={handleRemoveProvider}
                        onSetProvider={handleSetProvider}
                        onOpenCreditsDialog={handleOpenCreditsDialog}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availablePresets.map((preset) => {
                const isNostrPreset = preset.nostr;
                const isLoggedIntoNostr = !!user;
                const showNostrLoginRequired = isNostrPreset && !isLoggedIntoNostr;

                return (
                  <div key={preset.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium">{preset.name}</h5>
                      {(preset.apiKeysURL && preset.id !== "routstr") && (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline hover:text-foreground"
                          onClick={() => window.open(preset.apiKeysURL, '_blank')}
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
                        <Button
                          asChild
                          className="w-full"
                        >
                          <Link to="/settings/nostr">
                            {t('goToNostrSettings')}
                          </Link>
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {!preset.nostr && (
                          <PasswordInput
                            placeholder={preset.id === "routstr" ? t('enterCashuToken') : t('enterApiKey')}
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
                          disabled={!!preset.apiKeysURL && !presetApiKeys[preset.id]?.trim()}
                          className={preset.nostr ? "w-full" : "h-10 px-4 ml-auto"}
                        >
                          {t('add')}
                        </Button>
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
                    <Label htmlFor="custom-name">{t('providerName')}</Label>
                    <Input
                      id="custom-name"
                      placeholder="e.g., my-custom-api"
                      value={customProviderName}
                      onChange={(e) => setCustomProviderName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="custom-baseurl">{t('baseUrl')}</Label>
                    <Input
                      id="custom-baseurl"
                      placeholder="https://api.example.com/v1"
                      value={customBaseURL}
                      onChange={(e) => setCustomBaseURL(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="custom-auth">{t('authentication')}</Label>
                    <Select
                      value={customAuthMethod}
                      onValueChange={(value: 'api-key' | 'nostr') => {
                        setCustomAuthMethod(value);
                        if (value === 'nostr') {
                          setCustomApiKey(''); // Clear API key when switching to Nostr auth
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="api-key">{t('apiKey')}</SelectItem>
                        <SelectItem value="nostr">Nostr</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {customAuthMethod === 'api-key' && (
                    <div className="grid gap-2">
                      <Label htmlFor="custom-apikey">{t('apiKey')}</Label>
                      <PasswordInput
                        id="custom-apikey"
                        placeholder={t('enterApiKey') + ' (optional)'}
                        value={customApiKey}
                        onChange={(e) => setCustomApiKey(e.target.value)}
                      />
                    </div>
                  )}
                  <Button
                    onClick={handleAddCustomProvider}
                    disabled={
                      !customProviderName.trim() ||
                      !customBaseURL.trim() ||
                      settings.providers.some(p => p.id === customProviderName.trim())
                    }
                    className="gap-2 ml-auto"
                  >
                    <Check className="h-4 w-4" />
                    {t('addCustomProviderButton')}
                  </Button>
                  {settings.providers.some(p => p.id === customProviderName.trim()) && (
                    <p className="text-sm text-destructive">
                      {t('providerExists')}
                    </p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {/* Render credits dialog outside of accordion structure */}
      {activeCreditsDialog && (() => {
        const provider = settings.providers.find(p => p.id === activeCreditsDialog);
        return provider && (
          <CreditsDialog
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                handleCloseCreditsDialog();
              }
            }}
            providerId={activeCreditsDialog}
            connection={{ baseURL: provider.baseURL, apiKey: provider.apiKey, nostr: provider.nostr }}
          />
        );
      })()}
    </div>
  );
}

export default AISettings;