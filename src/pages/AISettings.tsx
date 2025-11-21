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
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CreditsBadge } from '@/components/CreditsBadge';
import { CreditsDialog } from '@/components/CreditsDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAISettings } from '@/hooks/useAISettings';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNavigate, Link } from 'react-router-dom';
import type { AIProvider } from '@/contexts/AISettingsContext';
import { AI_PROVIDER_PRESETS, type PresetProvider } from '@/lib/aiProviderPresets';
import { ExternalFavicon } from '@/components/ExternalFavicon';
import { MCPServersSection } from '@/components/MCPServersSection';
import { PluginsSection } from '@/components/PluginsSection';

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
        <div className="flex items-center gap-2 w-full mr-3">
          {showDragHandle && (
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground hover:text-foreground"
            >
              <GripVertical className="h-4 w-4" />
            </div>
          )}
          {provider.baseURL ? (
            <ExternalFavicon
              url={provider.baseURL}
              size={16}
              fallback={<Bot size={16} />}
            />
          ) : (
            <Bot size={16} />
          )}
          <span className="font-medium">
            {preset?.name || provider.id}
          </span>
          <div className="ml-auto">
            <CreditsBadge
              provider={provider}
              onOpenDialog={() => onOpenCreditsDialog(provider.id)}
            />
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
          <div className="flex items-center gap-2">
            <Checkbox
              id={`${provider.id}-proxy`}
              checked={provider.proxy || false}
              onCheckedChange={(checked) => onSetProvider({
                ...provider,
                proxy: checked === true || undefined
              })}
            />
            <Label htmlFor={`${provider.id}-proxy`} className="cursor-pointer">
              {t('useCorsProxy')}
            </Label>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onRemove(provider.id)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('delete')}
          </Button>
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
  const [customProxy, setCustomProxy] = useState(false);
  const [presetApiKeys, setPresetApiKeys] = useState<Record<string, string>>({});
  const [presetTermsAgreements, setPresetTermsAgreements] = useState<Record<string, boolean>>({});
  const [activeCreditsDialog, setActiveCreditsDialog] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAddPresetProvider = (preset: PresetProvider) => {
    const apiKey = presetApiKeys[preset.id] as string | undefined;

    // Check if user agreed to terms
    if (!presetTermsAgreements[preset.id]) return;

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
    if (typeof preset.proxy === 'boolean') {
      newProvider.proxy = preset.proxy;
    }

    // Auto-save: Add provider immediately to persistent storage
    setProvider(newProvider);

    // Clear the API key input and terms agreement for this preset
    setPresetApiKeys(prev => ({
      ...prev,
      [preset.id]: '',
    }));
    setPresetTermsAgreements(prev => ({
      ...prev,
      [preset.id]: false,
    }));
  };

  const handleAddCustomProvider = () => {
    if (!customProviderName.trim() || !customBaseURL.trim()) return;

    const newProvider: AIProvider = {
      id: customProviderName.trim(),
      baseURL: customBaseURL.trim(),
      apiKey: customAuthMethod === 'nostr' ? undefined : customApiKey.trim(),
      nostr: customAuthMethod === 'nostr' || undefined,
      proxy: customProxy || undefined,
    };

    // Auto-save: Add provider immediately to persistent storage
    setProvider(newProvider);

    setCustomProviderName('');
    setCustomBaseURL('');
    setCustomApiKey('');
    setCustomAuthMethod('api-key');
    setCustomProxy(false);
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
  const availablePresets = AI_PROVIDER_PRESETS.filter(preset => !configuredProviderIds.includes(preset.id));

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
                    const preset = AI_PROVIDER_PRESETS.find(p => p.id === provider.id);

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
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-3">
              {availablePresets.map((preset) => {
                const isNostrPreset = preset.nostr;
                const isLoggedIntoNostr = !!user;
                const showNostrLoginRequired = isNostrPreset && !isLoggedIntoNostr;

                return (
                  <div key={preset.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ExternalFavicon
                          url={preset.baseURL}
                          size={16}
                          fallback={<Bot size={16} />}
                        />
                        <h5 className="font-medium">{preset.name}</h5>
                      </div>
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
                      <div className="space-y-2">
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
                                if (e.key === 'Enter' &&
                                    presetApiKeys[preset.id]?.trim() &&
                                    presetTermsAgreements[preset.id]) {
                                  handleAddPresetProvider(preset);
                                }
                              }}
                            />
                          )}
                          <Button
                            onClick={() => handleAddPresetProvider(preset)}
                            disabled={
                              !presetTermsAgreements[preset.id] ||
                              (!!preset.apiKeysURL && !presetApiKeys[preset.id]?.trim())
                            }
                            className={preset.nostr ? "w-full" : "h-10 px-4 ml-auto"}
                          >
                            {t('add')}
                          </Button>
                        </div>

                        {/* Terms of Service Agreement */}
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            id={`agree-terms-${preset.id}`}
                            checked={presetTermsAgreements[preset.id] || false}
                            onCheckedChange={(checked) => setPresetTermsAgreements(prev => ({
                              ...prev,
                              [preset.id]: checked === true,
                            }))}
                            className="size-3 [&_svg]:size-3"
                          />
                          <label
                            htmlFor={`agree-terms-${preset.id}`}
                            className="text-xs text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {t('agreeToTermsOfService', { providerName: preset.name })}{' '}
                            {preset.tosURL ? (
                              <a
                                href={preset.tosURL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground underline hover:text-foreground hover:no-underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {t('termsOfService')}
                              </a>
                            ) : (
                              t('termsOfService')
                            )}
                          </label>
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
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="custom-proxy"
                      checked={customProxy}
                      onCheckedChange={(checked) => setCustomProxy(checked === true)}
                    />
                    <Label htmlFor="custom-proxy" className="cursor-pointer">
                      {t('useCorsProxy')}
                    </Label>
                  </div>
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

        {/* MCP Servers Section */}
        <MCPServersSection />

        {/* Plugins Section */}
        <PluginsSection />
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
            provider={provider}
          />
        );
      })()}
    </div>
  );
}

export default AISettings;