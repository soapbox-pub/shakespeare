import { useState } from 'react';
import { Settings, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAISettings } from '@/hooks/useAISettings';
import type { AIConnection } from '@/contexts/AISettingsContext';

export function AISettingsDialog() {
  const { settings, updateSettings, isConfigured } = useAISettings();
  const [open, setOpen] = useState(false);
  const [localProviders, setLocalProviders] = useState(settings.providers);
  const [newProviderName, setNewProviderName] = useState('');

  const handleSave = () => {
    updateSettings({ providers: localProviders });
    setOpen(false);
  };

  const handleCancel = () => {
    setLocalProviders(settings.providers);
    setNewProviderName('');
    setOpen(false);
  };

  const handleAddProvider = () => {
    if (!newProviderName.trim()) return;

    const newProvider: AIConnection = {
      baseURL: '',
      apiKey: '',
    };

    setLocalProviders(prev => ({
      ...prev,
      [newProviderName.trim()]: newProvider,
    }));
    setNewProviderName('');
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

  const providerNames = Object.keys(localProviders);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          AI Settings
          {!isConfigured && (
            <span className="ml-1 h-2 w-2 rounded-full bg-red-500" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Settings</DialogTitle>
          <DialogDescription>
            Configure multiple AI providers. These settings are stored locally in your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Existing Providers */}
          {providerNames.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Configured Providers</h4>
              {providerNames.map((name) => (
                <Card key={name}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveProvider(name)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-2">
                      <Label htmlFor={`${name}-apiKey`}>API Key</Label>
                      <Input
                        id={`${name}-apiKey`}
                        type="password"
                        placeholder="Enter your API key"
                        value={localProviders[name]?.apiKey || ''}
                        onChange={(e) => handleUpdateProvider(name, { apiKey: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`${name}-baseURL`}>Base URL</Label>
                      <Input
                        id={`${name}-baseURL`}
                        placeholder="https://api.example.com/v1"
                        value={localProviders[name]?.baseURL || ''}
                        onChange={(e) => handleUpdateProvider(name, { baseURL: e.target.value })}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {providerNames.length > 0 && <Separator />}

          {/* Add New Provider */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Add New Provider</h4>
            <div className="flex gap-2">
              <Input
                placeholder="Provider name (e.g., openai, anthropic)"
                value={newProviderName}
                onChange={(e) => setNewProviderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddProvider();
                  }
                }}
              />
              <Button
                onClick={handleAddProvider}
                disabled={!newProviderName.trim() || newProviderName.trim() in localProviders}
                size="sm"
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
            {newProviderName.trim() in localProviders && (
              <p className="text-sm text-destructive">
                Provider with this name already exists
              </p>
            )}
          </div>

          {/* Usage Instructions */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <h4 className="text-sm font-medium">Usage</h4>
            <p className="text-sm text-muted-foreground">
              In the chat, use the format <code className="bg-background px-1 rounded">provider/model</code> to specify which provider and model to use.
            </p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Examples:</strong></p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li><code className="bg-background px-1 rounded">openrouter/anthropic/claude-sonnet-4</code></li>
                <li><code className="bg-background px-1 rounded">openai/gpt-4o</code></li>
                <li><code className="bg-background px-1 rounded">anthropic/claude-3-5-sonnet-20241022</code></li>
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
