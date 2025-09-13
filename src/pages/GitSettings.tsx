import { useState } from 'react';
import { Check, GitBranch, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useGitSettings } from '@/hooks/useGitSettings';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useNavigate } from 'react-router-dom';
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

export function GitSettings() {
  const { settings, addCredential, removeCredential, updateCredential } = useGitSettings();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [customOrigin, setCustomOrigin] = useState('');
  const [customUsername, setCustomUsername] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [presetTokens, setPresetTokens] = useState<Record<string, string>>({});

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
            Back to Settings
          </Button>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <GitBranch className="h-6 w-6 text-primary" />
              Git Settings
            </h1>
            <p className="text-muted-foreground">
              Configure Git credentials for HTTP authentication. Settings are automatically saved and stored locally in your browser.
            </p>
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="space-y-2">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <GitBranch className="h-6 w-6 text-primary" />
            Git Settings
          </h1>
          <p className="text-muted-foreground">
            Configure Git credentials for HTTP authentication. Settings are automatically saved and stored locally in your browser.
          </p>
        </div>
      )}

      <div className="space-y-6">
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
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
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
                <div key={preset.id} className="border rounded-lg p-4 space-y-3">
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
                </div>
              ))}
            </div>
          </div>
        )}

        {availablePresets.length > 0 && <Separator />}

        {/* Custom Provider */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Add Custom Provider</h4>
          <div className="border rounded-lg p-4 space-y-3">
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default GitSettings;