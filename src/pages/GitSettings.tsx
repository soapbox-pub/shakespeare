import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, GitBranch, ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SiGithub, SiGitlab } from '@icons-pack/react-simple-icons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { useGitSettings } from '@/hooks/useGitSettings';
import { useGitHubOAuth } from '@/hooks/useGitHubOAuth';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useNavigate } from 'react-router-dom';
import type { GitCredential } from '@/contexts/GitSettingsContext';
import { PasswordInput } from '@/components/ui/password-input';

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
  const { t } = useTranslation();
  const { settings, addCredential, removeCredential, updateCredential, updateSettings } = useGitSettings();
  const { initiateOAuth, isLoading: isOAuthLoading, error: oauthError, isOAuthConfigured } = useGitHubOAuth();
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
            {t('backToSettings')}
          </Button>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <GitBranch className="h-6 w-6 text-primary" />
              {t('gitSettings')}
            </h1>
            <p className="text-muted-foreground">
              {t('gitSettingsDescriptionLong')}
            </p>
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="space-y-2">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <GitBranch className="h-6 w-6 text-primary" />
            {t('gitSettings')}
          </h1>
          <p className="text-muted-foreground">
            {t('gitSettingsDescriptionLong')}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Configured Credentials */}
        {configuredOrigins.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">{t('configuredCredentials')}</h4>
            <Accordion type="multiple" className="w-full space-y-2">
              {configuredOrigins.map((origin) => {
                const preset = PRESET_PROVIDERS.find(p => p.origin === origin);
                const credential = settings.credentials[origin];
                const isCustom = !preset;

                return (
                  <AccordionItem key={origin} value={origin} className="border rounded-lg">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2">
                        {preset?.id === 'github' && <SiGithub size={16} />}
                        {preset?.id === 'gitlab' && <SiGitlab size={16} />}
                        <span className="font-medium">
                          {preset?.name || new URL(origin).hostname}
                        </span>
                        {isCustom && <Badge variant="outline">{t('custom')}</Badge>}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-3">
                        <div className="grid gap-2">
                          <Label htmlFor={`${origin}-origin`}>{t('origin')}</Label>
                          <Input
                            id={`${origin}-origin`}
                            placeholder="https://github.com"
                            value={origin}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`${origin}-username`}>{t('username')}</Label>
                          <Input
                            id={`${origin}-username`}
                            placeholder="git"
                            value={credential?.username || ''}
                            onChange={(e) => handleUpdateCredential(origin, { username: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`${origin}-password`}>{t('password')}</Label>
                          <PasswordInput
                            id={`${origin}-password`}
                            placeholder={t('enterPassword')}
                            value={credential?.password || ''}
                            onChange={(e) => handleUpdateCredential(origin, { password: e.target.value })}
                          />
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveCredential(origin)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('delete')}
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}

        {/* Available Preset Providers */}
        {availablePresets.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">{t('addProvider')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availablePresets.map((preset) => (
                <div key={preset.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {preset.id === 'github' && <SiGithub size={16} />}
                      {preset.id === 'gitlab' && <SiGitlab size={16} />}
                      <h5 className="font-medium">{preset.name}</h5>
                    </div>
                    {preset.tokenURL && (preset.id !== 'github' || !isOAuthConfigured) && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline hover:text-foreground"
                        onClick={() => window.open(preset.tokenURL, '_blank')}
                      >
                        {t('getToken')}
                      </button>
                    )}
                  </div>

                  {preset.id === 'github' ? (
                    // Special rendering for GitHub - OAuth button if configured, otherwise token input
                    isOAuthConfigured ? (
                      <div className="space-y-3">
                        <Button
                          onClick={initiateOAuth}
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
                              <SiGithub size={16} />
                              <span className="truncate text-ellipsis overflow-hidden">
                                Connect to GitHub
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
                      <div className="flex gap-2">
                        <PasswordInput
                          placeholder={t('enterToken')}
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
                          {t('add')}
                        </Button>
                      </div>
                    )
                  ) : (
                    // Standard rendering for other providers
                    <div className="flex gap-2">
                      <PasswordInput
                        placeholder={t('enterToken')}
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
                        {t('add')}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
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
                    <Label htmlFor="custom-origin">{t('origin')}</Label>
                    <Input
                      id="custom-origin"
                      placeholder="https://git.example.com"
                      value={customOrigin}
                      onChange={(e) => setCustomOrigin(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="custom-username">{t('username')}</Label>
                    <Input
                      id="custom-username"
                      placeholder="git"
                      value={customUsername}
                      onChange={(e) => setCustomUsername(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="custom-password">{t('password')}</Label>
                    <PasswordInput
                      id="custom-password"
                      placeholder={t('enterPassword')}
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
                    {t('addCustomProviderButton')}
                  </Button>
                  {customOrigin.trim() in settings.credentials && (
                    <p className="text-sm text-destructive">
                      {t('credentialsExist')}
                    </p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Git Identity */}
        <div className="space-y-3">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="git-identity" className="border rounded-lg">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <h4 className="text-sm font-medium">{t('gitIdentity')}</h4>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="git-name">{t('name')}</Label>
                    <Input
                      id="git-name"
                      placeholder="Your Name"
                      value={settings.name || ''}
                      onChange={(e) => updateSettings({ name: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="git-email">{t('email')}</Label>
                    <Input
                      id="git-email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={settings.email || ''}
                      onChange={(e) => updateSettings({ email: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center justify-between space-x-2">
                    <Label htmlFor="co-author" className="flex-1 cursor-pointer">
                      {t('coAuthoredByShakespeare')}
                    </Label>
                    <Switch
                      id="co-author"
                      checked={settings.coAuthorEnabled ?? true}
                      onCheckedChange={(checked) => updateSettings({ coAuthorEnabled: checked })}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  );
}

export default GitSettings;