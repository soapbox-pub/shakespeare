import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, ChevronDown, RotateCcw, FileText, Edit, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CreditsDialog } from '@/components/CreditsDialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ProviderTile } from '@/components/ProviderTile';
import { AddProviderTile } from '@/components/AddProviderTile';
import { AIProviderConfigDialog } from '@/components/AIProviderConfigDialog';
import { AddAIProviderDialog } from '@/components/AddAIProviderDialog';
import { AddCustomAIProviderDialog } from '@/components/AddCustomAIProviderDialog';
import { CreditsBadge } from '@/components/CreditsBadge';
import { useAISettings } from '@/hooks/useAISettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAppContext } from '@/hooks/useAppContext';
import { SettingsPageLayout } from '@/components/SettingsPageLayout';
import type { AIProvider } from '@/contexts/AISettingsContext';
import { AI_PROVIDER_PRESETS, type PresetProvider } from '@/lib/aiProviderPresets';
import { MCPServersSection } from '@/components/MCPServersSection';
import { PluginsSection } from '@/components/PluginsSection';
import { ProjectTemplatesSection } from '@/components/ProjectTemplatesSection';
import { defaultSystemPrompt } from '@/lib/system';
import { ModelInput } from '@/components/ModelInput';

export function AISettings() {
  const { t } = useTranslation();
  const { settings, updateSettings, setProvider, removeProvider, isLoading } = useAISettings();
  const { user } = useCurrentUser();
  const { config, defaultConfig, updateConfig } = useAppContext();
  const [activeCreditsDialog, setActiveCreditsDialog] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [systemPromptInput, setSystemPromptInput] = useState(config.systemPrompt || defaultSystemPrompt);

  // Dialog state
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PresetProvider | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [customProviderDialogOpen, setCustomProviderDialogOpen] = useState(false);

  // Check if system prompt differs from default
  const isSystemPromptModified = useMemo(() =>
    (config.systemPrompt || defaultSystemPrompt) !== (defaultConfig.systemPrompt || defaultSystemPrompt),
  [config, defaultConfig]);

  const restoreSystemPrompt = () => {
    const defaultValue = defaultSystemPrompt;
    setSystemPromptInput(defaultValue);
    updateConfig((current) => {
      const { systemPrompt, ...rest } = current;
      return rest;
    });
  };

  const handleOpenProviderDialog = (providerId: string) => {
    setSelectedProviderId(providerId);
    setConfigDialogOpen(true);
  };

  const handleOpenAddDialog = (preset: PresetProvider) => {
    setSelectedPreset(preset);
    setAddDialogOpen(true);
  };

  const handleAddPresetProvider = (preset: PresetProvider, apiKey: string) => {
    const newProvider: AIProvider = {
      id: preset.id,
      name: preset.name,
      baseURL: preset.baseURL,
    };

    if (apiKey.trim()) {
      newProvider.apiKey = apiKey.trim();
    }
    if (typeof preset.nostr === 'boolean') {
      newProvider.nostr = preset.nostr;
    }
    if (typeof preset.proxy === 'boolean') {
      newProvider.proxy = preset.proxy;
    }

    setProvider(newProvider);
  };

  const handleAddCustomProvider = (provider: AIProvider) => {
    setProvider(provider);
  };

  const handleRemoveProvider = (id: string) => {
    removeProvider(id);
    setConfigDialogOpen(false);
  };

  const handleSetProvider = (provider: AIProvider) => {
    setProvider(provider);
  };

  const configuredProviderIds = settings.providers.map(p => p.id);
  const availablePresets = AI_PROVIDER_PRESETS.filter(preset => !configuredProviderIds.includes(preset.id));

  const imageModelFilter = useCallback((model: { type?: 'chat' | 'image'; modalities?: string[] }) => {
    // Filter out models that are definitely NOT image models
    // If type is "chat", exclude it
    if (model.type === 'chat') {
      return false;
    }
    // If modalities exist but don't include "image", exclude it
    if (model.modalities && !model.modalities.includes('image')) {
      return false;
    }
    // Otherwise include it (type is "image", modalities includes "image", or both are undefined)
    return true;
  }, []);

  return (
    <SettingsPageLayout
      icon={Bot}
      titleKey="aiSettings"
      descriptionKey="aiSettingsDescription"
    >
      {isLoading ? (
        <>
          {/* Loading skeleton for configured providers */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
              <Skeleton className="h-[120px] w-full rounded-lg" />
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
                {settings.providers.map((provider) => (
                  <ProviderTile
                    key={provider.id}
                    iconUrl={provider.baseURL}
                    icon={<Bot size={32} />}
                    name={provider.name}
                    onClick={() => handleOpenProviderDialog(provider.id)}
                    badge={
                      <CreditsBadge
                        provider={provider}
                        onOpenDialog={() => setActiveCreditsDialog(provider.id)}
                      />
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Provider Config Dialog */}
          {selectedProviderId !== null && (() => {
            const provider = settings.providers.find(p => p.id === selectedProviderId);
            return provider && (
              <AIProviderConfigDialog
                open={configDialogOpen}
                onOpenChange={setConfigDialogOpen}
                provider={provider}
                onUpdate={handleSetProvider}
                onRemove={() => handleRemoveProvider(provider.id)}
                onOpenCreditsDialog={() => setActiveCreditsDialog(provider.id)}
              />
            );
          })()}

          {/* Available Preset Providers */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">{t('addProvider')}</h4>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
              {availablePresets.map((preset) => (
                <ProviderTile
                  key={preset.id}
                  iconUrl={preset.baseURL}
                  icon={<Bot size={32} />}
                  name={preset.name}
                  onClick={() => handleOpenAddDialog(preset)}
                />
              ))}

              {/* Add Custom Provider Tile */}
              <AddProviderTile onClick={() => setCustomProviderDialogOpen(true)} />
            </div>

            {/* Add Preset Provider Dialog */}
            {selectedPreset && (
              <AddAIProviderDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
                preset={selectedPreset}
                isLoggedIntoNostr={!!user}
                onAdd={(apiKey) => handleAddPresetProvider(selectedPreset, apiKey)}
              />
            )}

            {/* Add Custom Provider Dialog */}
            <AddCustomAIProviderDialog
              open={customProviderDialogOpen}
              onOpenChange={setCustomProviderDialogOpen}
              onAdd={handleAddCustomProvider}
              existingIds={settings.providers.map(p => p.id)}
            />
          </div>

          {/* Advanced Settings */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>{t('advanced')}</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
              />
            </button>

            {showAdvanced && (
              <div className="space-y-6">
                {/* Image Model Configuration */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">{t('imageModel')}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('imageModelDescription')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ModelInput
                      value={settings.imageModel || ''}
                      onChange={(value) => updateSettings({ imageModel: value || undefined })}
                      className="flex-1"
                      modelFilter={imageModelFilter}
                    />
                    {settings.imageModel && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateSettings({ imageModel: undefined })}
                        className="h-10 px-3"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <Separator />

                {/* Project Templates Section */}
                <ProjectTemplatesSection />
                <Separator />

                {/* MCP Servers Section */}
                <MCPServersSection />
                <Separator />

                {/* Plugins Section */}
                <PluginsSection />
                <Separator />

                {/* System Prompt Configuration */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">{t('systemPrompt')}</h3>
                      {isSystemPromptModified && (
                        <div className="h-2 w-2 rounded-full bg-yellow-500" title={t('modified')} />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('systemPromptDescription')}
                    </p>
                  </div>
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="system-prompt" className="border rounded-lg">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Edit className="h-4 w-4" />
                          <span className="font-medium">{t('systemPrompt')}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-2">
                          <Textarea
                            id="system-prompt"
                            placeholder="Enter EJS template..."
                            value={systemPromptInput}
                            onChange={(e) => {
                              const value = e.target.value;
                              setSystemPromptInput(value);
                              updateConfig((current) => ({
                                ...current,
                                systemPrompt: value,
                              }));
                            }}
                            className="flex-1 font-mono text-xs min-h-[400px]"
                          />
                          {isSystemPromptModified && (
                            <Button
                              variant="outline"
                              onClick={restoreSystemPrompt}
                              className="w-full"
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              {t('restoreToDefault')}
                            </Button>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Render credits dialog */}
      {activeCreditsDialog && (() => {
        const provider = settings.providers.find(p => p.id === activeCreditsDialog);
        return provider && (
          <CreditsDialog
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                setActiveCreditsDialog(null);
              }
            }}
            provider={provider}
          />
        );
      })()}
    </SettingsPageLayout>
  );
}

export default AISettings;