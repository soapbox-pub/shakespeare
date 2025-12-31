import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GitBranch, ChevronDown, Plus, User, Globe, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useGitSettings } from '@/hooks/useGitSettings';
import { useGitHubOAuth } from '@/hooks/useGitHubOAuth';
import { useAppContext } from '@/hooks/useAppContext';
import { SettingsPageLayout } from '@/components/SettingsPageLayout';
import type { GitCredential } from '@/contexts/GitSettingsContext';
import { ExternalFavicon } from '@/components/ExternalFavicon';
import { ProviderTile } from '@/components/ProviderTile';
import { AddProviderTile } from '@/components/AddProviderTile';
import { GitCredentialConfigDialog } from '@/components/GitCredentialConfigDialog';
import { AddGitCredentialDialog } from '@/components/AddGitCredentialDialog';
import { AddCustomGitCredentialDialog } from '@/components/AddCustomGitCredentialDialog';

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
  const { settings, addCredential, removeCredential, setCredentials, updateSettings, isInitialized } = useGitSettings();
  const { initiateOAuth, isLoading: isOAuthLoading, error: oauthError, isOAuthConfigured } = useGitHubOAuth();
  const { config, updateConfig } = useAppContext();
  const [forceManualEntry, setForceManualEntry] = useState<Record<string, boolean>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newProxyOrigin, setNewProxyOrigin] = useState('');

  // Dialog state
  const [selectedCredentialId, setSelectedCredentialId] = useState<string | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PresetProvider | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [customCredentialDialogOpen, setCustomCredentialDialogOpen] = useState(false);

  const handleOpenCredentialDialog = (credentialId: string) => {
    setSelectedCredentialId(credentialId);
    setConfigDialogOpen(true);
  };

  const handleOpenAddDialog = (preset: PresetProvider) => {
    setSelectedPreset(preset);
    setAddDialogOpen(true);
  };

  const handleAddPresetProvider = (preset: PresetProvider, token: string) => {
    if (!token.trim()) return;

    const newCredential: GitCredential = {
      id: crypto.randomUUID(),
      name: preset.name,
      origin: preset.origin,
      username: preset.username,
      password: token.trim(),
    };

    addCredential(newCredential);
  };

  const handleAddCustomCredential = (credential: Omit<GitCredential, 'id'>) => {
    const newCredential: GitCredential = {
      ...credential,
      id: crypto.randomUUID(),
    };

    addCredential(newCredential);
  };

  const handleRemoveCredential = (id: string) => {
    removeCredential(id);
    setConfigDialogOpen(false);
  };

  const handleUpdateCredential = (updatedCredential: GitCredential) => {
    const updatedCredentials = settings.credentials.map((cred) =>
      cred.id === updatedCredential.id ? updatedCredential : cred
    );
    setCredentials(updatedCredentials);
  };

  const handleAddProxyOrigin = () => {
    if (!newProxyOrigin.trim()) return;

    // Validate URL format
    try {
      const url = new URL(newProxyOrigin.trim());
      const origin = url.origin;

      // Check if origin already exists
      if (config.gitProxyOrigins.includes(origin)) {
        return;
      }

      updateConfig((current) => ({
        ...current,
        gitProxyOrigins: [...config.gitProxyOrigins, origin],
      }));

      setNewProxyOrigin('');
    } catch {
      // Invalid URL - don't add
    }
  };

  const handleRemoveProxyOrigin = (origin: string) => {
    updateConfig((current) => ({
      ...current,
      gitProxyOrigins: config.gitProxyOrigins.filter((o) => o !== origin),
    }));
  };

  // Get list of configured origins
  const configuredOrigins = settings.credentials.map(cred => cred.origin);
  const availablePresets = PRESET_PROVIDERS.filter(preset => !configuredOrigins.includes(preset.origin));

  return (
    <SettingsPageLayout
      icon={GitBranch}
      titleKey="gitSettings"
      descriptionKey="gitSettingsDescription"
    >
      {!isInitialized ? (
        <>
          {/* Loading skeleton for configured credentials */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
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
            </div>
          </div>

          {/* Loading skeleton for git identity */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <div className="space-y-2">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Configured Credentials */}
          {settings.credentials.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">{t('configuredCredentials')}</h4>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
                {settings.credentials.map((credential) => {
                  const preset = PRESET_PROVIDERS.find(p => p.origin === credential.origin);
                  const isCustom = !preset;

                  return (
                    <ProviderTile
                      key={credential.id}
                      iconUrl={credential.origin}
                      icon={<GitBranch size={32} />}
                      name={credential.name}
                      onClick={() => handleOpenCredentialDialog(credential.id)}
                      badge={isCustom ? <span className="text-xs px-1.5 py-0.5 bg-muted rounded">{t('custom')}</span> : undefined}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Credential Config Dialog */}
          {selectedCredentialId !== null && (() => {
            const credential = settings.credentials.find(c => c.id === selectedCredentialId);
            const preset = credential && PRESET_PROVIDERS.find(p => p.origin === credential.origin);
            const isCustom = credential && !preset;

            return credential && (
              <GitCredentialConfigDialog
                open={configDialogOpen}
                onOpenChange={setConfigDialogOpen}
                credential={credential}
                onUpdate={handleUpdateCredential}
                onRemove={() => handleRemoveCredential(credential.id)}
                isCustom={isCustom}
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
                  iconUrl={preset.origin}
                  icon={<GitBranch size={32} />}
                  name={preset.name}
                  onClick={() => handleOpenAddDialog(preset)}
                />
              ))}

              {/* Add Custom Credential Tile */}
              <AddProviderTile onClick={() => setCustomCredentialDialogOpen(true)} />
            </div>

            {/* Add Preset Credential Dialog */}
            {selectedPreset && (
              <AddGitCredentialDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
                preset={selectedPreset}
                oauthHook={
                  selectedPreset.id === 'github' ? {
                    initiateOAuth,
                    isLoading: isOAuthLoading,
                    error: oauthError,
                    isOAuthConfigured,
                  } : null
                }
                forceManualEntry={forceManualEntry[selectedPreset.id] || false}
                onSetForceManualEntry={(force) =>
                  setForceManualEntry(prev => ({ ...prev, [selectedPreset.id]: force }))
                }
                onAdd={(token) => handleAddPresetProvider(selectedPreset, token)}
              />
            )}

            {/* Add Custom Credential Dialog */}
            <AddCustomGitCredentialDialog
              open={customCredentialDialogOpen}
              onOpenChange={setCustomCredentialDialogOpen}
              onAdd={handleAddCustomCredential}
              existingOrigins={settings.credentials.map(c => c.origin)}
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
                {/* Git Identity */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">{t('gitIdentity')}</h3>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="git-name">{t('name')}</Label>
                        <Input
                          id="git-name"
                          placeholder="Your Name"
                          value={settings.name || ''}
                          onChange={(e) => updateSettings({ name: e.target.value })}
                          className="bg-muted/50"
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
                          className="bg-muted/50"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Switch
                        id="co-author"
                        checked={settings.coAuthorEnabled ?? true}
                        onCheckedChange={(checked) => updateSettings({ coAuthorEnabled: checked })}
                        className="scale-75"
                      />
                      <Label htmlFor="co-author" className="text-xs cursor-pointer font-normal text-muted-foreground">
                        {t('coAuthoredByShakespeare')}
                      </Label>
                    </div>
                  </div>
                </div>

                {/* CORS Proxy Origins */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">{t('corsProxyOrigins')}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('corsProxyOriginsDescription')}
                    </p>
                  </div>

                  {/* List of configured origins */}
                  {config.gitProxyOrigins.length > 0 && (
                    <div className="space-y-2">
                      {config.gitProxyOrigins.map((origin) => (
                        <div
                          key={origin}
                          className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50"
                        >
                          <ExternalFavicon
                            url={origin}
                            size={16}
                            fallback={<Globe size={16} />}
                          />
                          <span className="flex-1 text-sm font-mono">{origin}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveProxyOrigin(origin)}
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add new origin */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://github.com"
                      value={newProxyOrigin}
                      onChange={(e) => setNewProxyOrigin(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddProxyOrigin();
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleAddProxyOrigin}
                      disabled={!newProxyOrigin.trim()}
                      size="sm"
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      {t('add')}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </SettingsPageLayout>
  );
}

export default GitSettings;