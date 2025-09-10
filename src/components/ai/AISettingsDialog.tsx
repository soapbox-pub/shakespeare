import { useState } from 'react';
import { Settings, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useAISettings } from '@/hooks/useAISettings';
import type { AIConnection } from '@/contexts/AISettingsContext';

interface PresetProvider {
  id: string;
  name: string;
  baseURL: string;
  apiKeysURL: string;
}

const PRESET_PROVIDERS: PresetProvider[] = [
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
    id: "zai",
    name: "Z.ai",
    baseURL: "https://api.z.ai/api/paas/v4",
    apiKeysURL: "https://z.ai/manage-apikey/apikey-list",
  },
  {
    id: "moonshot",
    name: "Moonshot",
    baseURL: "https://api.moonshot.ai/v1",
    apiKeysURL: "https://platform.moonshot.ai/console/api-keys",
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

interface AISettingsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AISettingsDialog({ open: controlledOpen, onOpenChange }: AISettingsDialogProps = {}) {
  const { settings, addProvider, removeProvider, updateProvider, isConfigured } = useAISettings();
  const [internalOpen, setInternalOpen] = useState(false);

  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [customProviderName, setCustomProviderName] = useState('');
  const [customBaseURL, setCustomBaseURL] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [presetApiKeys, setPresetApiKeys] = useState<Record<string, string>>({});

  const handleCancel = () => {
    setCustomProviderName('');
    setCustomBaseURL('');
    setCustomApiKey('');
    setPresetApiKeys({});
    setOpen(false);
  };

  const handleAddPresetProvider = (preset: PresetProvider) => {
    const apiKey = presetApiKeys[preset.id] || '';
    if (!apiKey.trim()) return;

    const newProvider: AIConnection = {
      baseURL: preset.baseURL,
      apiKey: apiKey.trim(),
    };

    // Auto-save: Add provider immediately to persistent storage
    addProvider(preset.id, newProvider);

    // Clear the API key input for this preset
    setPresetApiKeys(prev => ({
      ...prev,
      [preset.id]: '',
    }));
  };

  const handleAddCustomProvider = () => {
    if (!customProviderName.trim() || !customBaseURL.trim()) return;

    const newProvider: AIConnection = {
      baseURL: customBaseURL.trim(),
      apiKey: customApiKey.trim(),
    };

    // Auto-save: Add provider immediately to persistent storage
    addProvider(customProviderName.trim(), newProvider);

    setCustomProviderName('');
    setCustomBaseURL('');
    setCustomApiKey('');
  };

  const handleRemoveProvider = (name: string) => {
    // Auto-save: Remove provider immediately from persistent storage
    removeProvider(name);
  };

  const handleUpdateProvider = (name: string, connection: Partial<AIConnection>) => {
    // Auto-save: Update provider immediately in persistent storage
    updateProvider(name, connection);
  };

  const configuredProviderIds = Object.keys(settings.providers);
  const availablePresets = PRESET_PROVIDERS.filter(preset => !configuredProviderIds.includes(preset.id));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Only show trigger if not controlled externally */}
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            AI Settings
            {!isConfigured && (
              <span className="ml-1 h-2 w-2 rounded-full bg-red-500" />
            )}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Settings</DialogTitle>
          <DialogDescription>
            Configure AI providers by adding your API keys. Settings are automatically saved and stored locally in your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Configured Providers */}
          {configuredProviderIds.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Configured Providers</h4>
              <Accordion type="multiple" className="w-full space-y-2">
                {configuredProviderIds.map((providerId) => {
                  const preset = PRESET_PROVIDERS.find(p => p.id === providerId);
                  const provider = settings.providers[providerId];
                  const isCustom = !preset;

                  return (
                    <AccordionItem key={providerId} value={providerId} className="border rounded-lg">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center justify-between w-full mr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {preset?.name || providerId}
                            </span>
                            {isCustom && <Badge variant="outline">Custom</Badge>}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveProvider(providerId);
                            }}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-3">
                          <div className="grid gap-2">
                            <Label htmlFor={`${providerId}-baseURL`}>Base URL</Label>
                            <Input
                              id={`${providerId}-baseURL`}
                              placeholder="https://api.example.com/v1"
                              value={provider?.baseURL || ''}
                              onChange={(e) => handleUpdateProvider(providerId, { baseURL: e.target.value })}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor={`${providerId}-apiKey`}>API Key</Label>
                            <Input
                              id={`${providerId}-apiKey`}
                              type="password"
                              placeholder="Enter your API key"
                              value={provider?.apiKey || ''}
                              onChange={(e) => handleUpdateProvider(providerId, { apiKey: e.target.value })}
                            />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          )}

          {configuredProviderIds.length > 0 && availablePresets.length > 0 && <Separator />}

          {/* Available Preset Providers */}
          {availablePresets.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Add Provider</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availablePresets.map((preset) => (
                  <Card key={preset.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium">{preset.name}</h5>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline hover:text-foreground"
                          onClick={() => window.open(preset.apiKeysURL, '_blank')}
                        >
                          Get API key
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter your API key"
                          type="password"
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
                        <Button
                          onClick={() => handleAddPresetProvider(preset)}
                          disabled={!presetApiKeys[preset.id]?.trim()}
                          size="sm"
                        >
                          Add
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {availablePresets.length > 0 && <Separator />}

          {/* Custom Provider */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Add Custom Provider</h4>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="custom-name">Provider Name</Label>
                  <Input
                    id="custom-name"
                    placeholder="e.g., my-custom-api"
                    value={customProviderName}
                    onChange={(e) => setCustomProviderName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="custom-baseurl">Base URL</Label>
                  <Input
                    id="custom-baseurl"
                    placeholder="https://api.example.com/v1"
                    value={customBaseURL}
                    onChange={(e) => setCustomBaseURL(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="custom-apikey">API Key</Label>
                  <Input
                    id="custom-apikey"
                    type="password"
                    placeholder="Enter your API key (optional)"
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleAddCustomProvider}
                  disabled={
                    !customProviderName.trim() ||
                    !customBaseURL.trim() ||
                    customProviderName.trim() in settings.providers
                  }
                  size="sm"
                  className="gap-2"
                >
                  <Check className="h-4 w-4" />
                  Add Custom Provider
                </Button>
                {customProviderName.trim() in settings.providers && (
                  <p className="text-sm text-destructive">
                    Provider with this name already exists
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={handleCancel}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
