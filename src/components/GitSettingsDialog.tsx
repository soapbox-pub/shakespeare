import { useState } from 'react';
import { GitBranch, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useGitSettings } from '@/hooks/useGitSettings';
import type { GitCredential } from '@/contexts/GitSettingsContext';

interface PresetProvider {
  id: string;
  name: string;
  origin: string;
  username: string;
  tokenURL?: string;
}

const PRESET_PROVIDERS: PresetProvider[] = [
  {
    id: "github",
    name: "GitHub",
    origin: "https://github.com",
    username: "git",
    tokenURL: "https://github.com/settings/tokens",
  },
  {
    id: "gitlab",
    name: "GitLab",
    origin: "https://gitlab.com",
    username: "git",
    tokenURL: "https://gitlab.com/-/user_settings/personal_access_tokens",
  },
];

interface GitSettingsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function GitSettingsDialog({ open: controlledOpen, onOpenChange }: GitSettingsDialogProps = {}) {
  const { settings, addCredential, removeCredential, updateCredential, isConfigured } = useGitSettings();
  const [internalOpen, setInternalOpen] = useState(false);

  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [customOrigin, setCustomOrigin] = useState('');
  const [customUsername, setCustomUsername] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [presetTokens, setPresetTokens] = useState<Record<string, string>>({});

  const handleCancel = () => {
    setCustomOrigin('');
    setCustomUsername('');
    setCustomPassword('');
    setPresetTokens({});
    setOpen(false);
  };

  const handleAddPresetProvider = (preset: PresetProvider) => {
    const token = presetTokens[preset.id] as string | undefined;

    if (!token?.trim()) return;

    const newCredential: GitCredential = {
      username: preset.username,
      password: token.trim(),
    };

    // Auto-save: Add credential immediately to persistent storage
    addCredential(preset.origin, newCredential);

    // Clear the token input for this preset
    setPresetTokens(prev => ({
      ...prev,
      [preset.id]: '',
    }));
  };

  const handleAddCustomProvider = () => {
    if (!customOrigin.trim() || !customUsername.trim() || !customPassword.trim()) return;

    const newCredential: GitCredential = {
      username: customUsername.trim(),
      password: customPassword.trim(),
    };

    // Auto-save: Add credential immediately to persistent storage
    addCredential(customOrigin.trim(), newCredential);

    setCustomOrigin('');
    setCustomUsername('');
    setCustomPassword('');
  };

  const handleRemoveCredential = (origin: string) => {
    // Auto-save: Remove credential immediately from persistent storage
    removeCredential(origin);
  };

  const handleUpdateCredential = (origin: string, credential: Partial<GitCredential>) => {
    // Auto-save: Update credential immediately in persistent storage
    updateCredential(origin, credential);
  };

  const configuredOrigins = Object.keys(settings.credentials);
  const availablePresets = PRESET_PROVIDERS.filter(preset => !configuredOrigins.includes(preset.origin));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Only show trigger if not controlled externally */}
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <GitBranch className="h-4 w-4" />
            Git Settings
            {!isConfigured && (
              <span className="ml-1 h-2 w-2 rounded-full bg-red-500" />
            )}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Git Settings</DialogTitle>
          <DialogDescription>
            Configure Git credentials for HTTP authentication. Settings are automatically saved and stored locally in your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Configured Credentials */}
          {configuredOrigins.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Configured Credentials</h4>
              <Accordion type="multiple" className="w-full space-y-2">
                {configuredOrigins.map((origin) => {
                  const preset = PRESET_PROVIDERS.find(p => p.origin === origin);
                  const credential = settings.credentials[origin];
                  const isCustom = !preset;

                  return (
                    <AccordionItem key={origin} value={origin} className="border rounded-lg">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center justify-between w-full mr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {preset?.name || new URL(origin).hostname}
                            </span>
                            {isCustom && <Badge variant="outline">Custom</Badge>}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveCredential(origin);
                            }}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive rounded-md hover:bg-accent"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-3">
                          <div className="grid gap-2">
                            <Label htmlFor={`${origin}-origin`}>Origin</Label>
                            <Input
                              id={`${origin}-origin`}
                              placeholder="https://github.com"
                              value={origin}
                              disabled
                              className="bg-muted"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor={`${origin}-username`}>Username</Label>
                            <Input
                              id={`${origin}-username`}
                              placeholder="git"
                              value={credential?.username || ''}
                              onChange={(e) => handleUpdateCredential(origin, { username: e.target.value })}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor={`${origin}-password`}>Password</Label>
                            <Input
                              id={`${origin}-password`}
                              type="password"
                              placeholder="Enter your password/token"
                              value={credential?.password || ''}
                              onChange={(e) => handleUpdateCredential(origin, { password: e.target.value })}
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

          {configuredOrigins.length > 0 && availablePresets.length > 0 && <Separator />}

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
                        {preset.tokenURL && (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground underline hover:text-foreground"
                            onClick={() => window.open(preset.tokenURL, '_blank')}
                          >
                            Get token
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter your token"
                          type="password"
                          className="flex-1"
                          value={presetTokens[preset.id] || ''}
                          onChange={(e) => setPresetTokens(prev => ({
                            ...prev,
                            [preset.id]: e.target.value,
                          }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && presetTokens[preset.id]?.trim()) {
                              handleAddPresetProvider(preset);
                            }
                          }}
                        />
                        <Button
                          onClick={() => handleAddPresetProvider(preset)}
                          disabled={!presetTokens[preset.id]?.trim()}
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
                  <Label htmlFor="custom-origin">Origin</Label>
                  <Input
                    id="custom-origin"
                    placeholder="https://git.example.com"
                    value={customOrigin}
                    onChange={(e) => setCustomOrigin(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="custom-username">Username</Label>
                  <Input
                    id="custom-username"
                    placeholder="git"
                    value={customUsername}
                    onChange={(e) => setCustomUsername(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="custom-password">Password</Label>
                  <Input
                    id="custom-password"
                    type="password"
                    placeholder="Enter your password/token"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleAddCustomProvider}
                  disabled={
                    !customOrigin.trim() ||
                    !customUsername.trim() ||
                    !customPassword.trim() ||
                    customOrigin.trim() in settings.credentials
                  }
                  size="sm"
                  className="gap-2"
                >
                  <Check className="h-4 w-4" />
                  Add Custom Provider
                </Button>
                {customOrigin.trim() in settings.credentials && (
                  <p className="text-sm text-destructive">
                    Credentials for this origin already exist
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