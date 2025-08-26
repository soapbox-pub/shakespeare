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
  description: string;
}

const PRESET_PROVIDERS: PresetProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    description: 'GPT-4, GPT-3.5 Turbo, and other OpenAI models'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseURL: 'https://api.anthropic.com/v1',
    description: 'Claude 3.5 Sonnet, Claude 3 Opus, and other Claude models'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    description: 'Access to hundreds of models from various providers'
  },
  {
    id: 'together',
    name: 'Together AI',
    baseURL: 'https://api.together.xyz/v1',
    description: 'Open-source models like Llama, Mistral, and more'
  },
  {
    id: 'groq',
    name: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    description: 'Ultra-fast inference for Llama, Mixtral, and Gemma models'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    description: 'DeepSeek-V2.5 and other high-performance models'
  }
];

interface AISettingsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AISettingsDialog({ open: controlledOpen, onOpenChange }: AISettingsDialogProps = {}) {
  const { settings, updateSettings, isConfigured } = useAISettings();
  const [internalOpen, setInternalOpen] = useState(false);

  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [localProviders, setLocalProviders] = useState(settings.providers);
  const [customProviderName, setCustomProviderName] = useState('');
  const [customBaseURL, setCustomBaseURL] = useState('');

  const handleSave = () => {
    updateSettings({ providers: localProviders });
    setOpen(false);
  };

  const handleCancel = () => {
    setLocalProviders(settings.providers);
    setCustomProviderName('');
    setCustomBaseURL('');
    setOpen(false);
  };

  const handleAddPresetProvider = (preset: PresetProvider) => {
    const newProvider: AIConnection = {
      baseURL: preset.baseURL,
      apiKey: '',
    };

    setLocalProviders(prev => ({
      ...prev,
      [preset.id]: newProvider,
    }));
  };

  const handleAddCustomProvider = () => {
    if (!customProviderName.trim() || !customBaseURL.trim()) return;

    const newProvider: AIConnection = {
      baseURL: customBaseURL.trim(),
      apiKey: '',
    };

    setLocalProviders(prev => ({
      ...prev,
      [customProviderName.trim()]: newProvider,
    }));
    setCustomProviderName('');
    setCustomBaseURL('');
  };

  const handleRemoveProvider = (name: string) => {
    setLocalProviders(prev => {
      const { [name]: removed, ...rest } = prev;
      return rest;
    });
  };

  const handleUpdateProvider = (name: string, connection: Partial<AIConnection>) => {
    setLocalProviders(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        ...connection,
      },
    }));
  };

  const configuredProviderIds = Object.keys(localProviders);
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
            Configure AI providers by adding your API keys. Settings are stored locally in your browser.
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
                  const provider = localProviders[providerId];
                  const isCustom = !preset;
                  const hasApiKey = provider?.apiKey && provider.apiKey.length > 0;

                  return (
                    <AccordionItem key={providerId} value={providerId} className="border rounded-lg">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center justify-between w-full mr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {preset?.name || providerId}
                            </span>
                            {isCustom && <Badge variant="outline">Custom</Badge>}
                            {hasApiKey && (
                              <Badge variant="secondary" className="text-xs">
                                Configured
                              </Badge>
                            )}
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
                          {preset && (
                            <p className="text-sm text-muted-foreground">{preset.description}</p>
                          )}
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
                          <div className="grid gap-2">
                            <Label htmlFor={`${providerId}-baseURL`}>Base URL</Label>
                            <Input
                              id={`${providerId}-baseURL`}
                              placeholder="https://api.example.com/v1"
                              value={provider?.baseURL || ''}
                              onChange={(e) => handleUpdateProvider(providerId, { baseURL: e.target.value })}
                            />
                            {preset && (
                              <p className="text-xs text-muted-foreground">
                                Default: {preset.baseURL}
                              </p>
                            )}
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
              <div className="grid gap-3">
                {availablePresets.map((preset) => (
                  <Card key={preset.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h5 className="font-medium">{preset.name}</h5>
                            <Badge variant="secondary" className="text-xs">Preset</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{preset.description}</p>
                          <p className="text-xs text-muted-foreground font-mono">{preset.baseURL}</p>
                        </div>
                        <Button
                          onClick={() => handleAddPresetProvider(preset)}
                          size="sm"
                          className="gap-2"
                        >
                          <Check className="h-4 w-4" />
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
                <Button
                  onClick={handleAddCustomProvider}
                  disabled={
                    !customProviderName.trim() ||
                    !customBaseURL.trim() ||
                    customProviderName.trim() in localProviders
                  }
                  size="sm"
                  className="gap-2"
                >
                  <Check className="h-4 w-4" />
                  Add Custom Provider
                </Button>
                {customProviderName.trim() in localProviders && (
                  <p className="text-sm text-destructive">
                    Provider with this name already exists
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Usage Instructions */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-medium">Usage</h4>
            <p className="text-sm text-muted-foreground">
              In the chat, use the format <code className="bg-background px-1 rounded">provider/model</code> to specify which provider and model to use.
            </p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Examples:</strong></p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li><code className="bg-background px-1 rounded">openrouter/anthropic/claude-3.5-sonnet</code></li>
                <li><code className="bg-background px-1 rounded">openai/gpt-4o</code></li>
                <li><code className="bg-background px-1 rounded">anthropic/claude-3-5-sonnet-20241022</code></li>
                <li><code className="bg-background px-1 rounded">groq/llama-3.1-70b-versatile</code></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
