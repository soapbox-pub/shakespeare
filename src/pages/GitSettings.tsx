import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, GitBranch, Trash2, ChevronDown, Plus, User, GripVertical, Globe, X } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useGitSettings } from '@/hooks/useGitSettings';
import { useGitHubOAuth } from '@/hooks/useGitHubOAuth';
import { useAppContext } from '@/hooks/useAppContext';
import { SettingsPageLayout } from '@/components/SettingsPageLayout';
import type { GitCredential } from '@/contexts/GitSettingsContext';
import { PasswordInput } from '@/components/ui/password-input';
import { ExternalInput } from '@/components/ui/external-input';
import { ExternalFavicon } from '@/components/ExternalFavicon';

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

interface SortableCredentialItemProps {
  credential: GitCredential;
  onUpdate: (updatedCredential: GitCredential) => void;
  onRemove: (id: string) => void;
  showDragHandle: boolean;
}

function SortableCredentialItem({ credential, onUpdate, onRemove, showDragHandle }: SortableCredentialItemProps) {
  const { t } = useTranslation();
  const preset = PRESET_PROVIDERS.find(p => p.origin === credential.origin);
  const isCustom = !preset;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: credential.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const updateCredential = (updates: Partial<GitCredential>) => {
    onUpdate({ ...credential, ...updates });
  };

  return (
    <AccordionItem
      ref={setNodeRef}
      style={style}
      value={credential.id}
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
          <ExternalFavicon
            url={credential.origin}
            size={16}
            fallback={<GitBranch size={16} />}
          />
          <span className="font-medium">
            {credential.name}
          </span>
          {isCustom && <Badge variant="outline">{t('custom')}</Badge>}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor={`credential-${credential.id}-name`}>
              {t('name')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`credential-${credential.id}-name`}
              placeholder="GitHub"
              value={credential.name}
              onChange={(e) => updateCredential({ name: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`credential-${credential.id}-origin`}>
              {t('origin')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`credential-${credential.id}-origin`}
              placeholder="https://github.com"
              value={credential.origin}
              onChange={(e) => updateCredential({ origin: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`credential-${credential.id}-username`}>
              {t('username')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`credential-${credential.id}-username`}
              placeholder="git"
              value={credential.username}
              onChange={(e) => updateCredential({ username: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`credential-${credential.id}-password`}>
              {t('password')} <span className="text-destructive">*</span>
            </Label>
            <PasswordInput
              id={`credential-${credential.id}-password`}
              placeholder={t('enterPassword')}
              value={credential.password}
              onChange={(e) => updateCredential({ password: e.target.value })}
            />
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onRemove(credential.id)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('delete')}
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function GitSettings() {
  const { t } = useTranslation();
  const { settings, addCredential, removeCredential, setCredentials, updateSettings, isInitialized } = useGitSettings();
  const { initiateOAuth, isLoading: isOAuthLoading, error: oauthError, isOAuthConfigured } = useGitHubOAuth();
  const { config, updateConfig } = useAppContext();
  const [customName, setCustomName] = useState('');
  const [customOrigin, setCustomOrigin] = useState('');
  const [customUsername, setCustomUsername] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [presetTokens, setPresetTokens] = useState<Record<string, string>>({});
  const [forceManualEntry, setForceManualEntry] = useState<Record<string, boolean>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newProxyOrigin, setNewProxyOrigin] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAddPresetProvider = (preset: PresetProvider) => {
    const token = presetTokens[preset.id] as string | undefined;

    if (!token?.trim()) return;

    const newCredential: GitCredential = {
      id: crypto.randomUUID(),
      name: preset.name,
      origin: preset.origin,
      username: preset.username,
      password: token.trim(),
    };

    // Auto-save: Add credential immediately to persistent storage
    addCredential(newCredential);

    // Clear the token input for this preset
    setPresetTokens(prev => ({
      ...prev,
      [preset.id]: '',
    }));
  };

  const handleAddCustomProvider = () => {
    if (!customName.trim() || !customOrigin.trim() || !customUsername.trim() || !customPassword.trim()) return;

    const newCredential: GitCredential = {
      id: crypto.randomUUID(),
      name: customName.trim(),
      origin: customOrigin.trim(),
      username: customUsername.trim(),
      password: customPassword.trim(),
    };

    // Auto-save: Add credential immediately to persistent storage
    addCredential(newCredential);

    setCustomName('');
    setCustomOrigin('');
    setCustomUsername('');
    setCustomPassword('');
  };

  const handleRemoveCredential = (id: string) => {
    // Auto-save: Remove credential immediately from persistent storage
    removeCredential(id);
  };

  const handleUpdateCredential = (updatedCredential: GitCredential) => {
    // Auto-save: Update credential immediately in persistent storage
    const updatedCredentials = settings.credentials.map((cred) =>
      cred.id === updatedCredential.id ? updatedCredential : cred
    );
    setCredentials(updatedCredentials);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = settings.credentials.findIndex((cred) => cred.id === active.id);
      const newIndex = settings.credentials.findIndex((cred) => cred.id === over?.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newCredentials = arrayMove(settings.credentials, oldIndex, newIndex);
        setCredentials(newCredentials);
      }
    }
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
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          </div>

          {/* Loading skeleton for add provider section */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          </div>

          {/* Loading skeleton for custom provider */}
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>

          {/* Loading skeleton for git identity */}
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </>
      ) : (
        <>
          {/* Configured Credentials */}
          {settings.credentials.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">{t('configuredCredentials')}</h4>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={settings.credentials.map((cred) => cred.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <Accordion type="multiple" className="w-full space-y-2">
                    {settings.credentials.map((credential) => (
                      <SortableCredentialItem
                        key={credential.id}
                        credential={credential}
                        onUpdate={handleUpdateCredential}
                        onRemove={handleRemoveCredential}
                        showDragHandle={settings.credentials.length > 1}
                      />
                    ))}
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
                {availablePresets.map((preset) => (
                  <Card key={preset.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <ExternalFavicon
                          url={preset.origin}
                          size={16}
                          fallback={<GitBranch size={16} />}
                        />
                        <h5 className="font-medium">{preset.name}</h5>
                      </div>

                      {preset.id === 'github' ? (
                      // Special rendering for GitHub - OAuth button if configured, otherwise token input
                        isOAuthConfigured && !forceManualEntry[preset.id] ? (
                          <div className="space-y-3">
                            <div className="flex gap-0">
                              <Button
                                onClick={initiateOAuth}
                                disabled={isOAuthLoading}
                                className="flex-1 rounded-r-none gap-2"
                                variant="default"
                              >
                                {isOAuthLoading ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  Connecting...
                                  </>
                                ) : (
                                  <>
                                    <ExternalFavicon
                                      url="https://github.com"
                                      size={16}
                                      fallback={<GitBranch size={16} />}
                                    />
                                    <span className="truncate text-ellipsis overflow-hidden">
                                    Connect to GitHub
                                    </span>
                                  </>
                                )}
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="default"
                                    className="rounded-l-none border-l border-primary-foreground/20 px-2"
                                    disabled={isOAuthLoading}
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => setForceManualEntry(prev => ({ ...prev, [preset.id]: true }))}
                                  >
                                  Enter API key
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            {oauthError && (
                              <p className="text-sm text-destructive">
                                {oauthError}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <ExternalInput
                              type="password"
                              className="flex-1"
                              placeholder={t('enterToken')}
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
                              url={preset.tokenURL}
                              urlTitle="Get Token"
                            />
                            <Button
                              onClick={() => handleAddPresetProvider(preset)}
                              disabled={!presetTokens[preset.id]?.trim()}
                              size="sm"
                              className="h-10"
                            >
                              {t('add')}
                            </Button>
                          </div>
                        )
                      ) : (
                      // Standard rendering for other providers
                        <div className="flex gap-2">
                          <ExternalInput
                            type="password"
                            className="flex-1"
                            placeholder={t('enterToken')}
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
                            url={preset.tokenURL}
                            urlTitle="Get Token"
                          />
                          <Button
                            onClick={() => handleAddPresetProvider(preset)}
                            disabled={!presetTokens[preset.id]?.trim()}
                            size="sm"
                            className="h-10"
                          >
                            {t('add')}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Custom Provider */}
          <div className="space-y-3">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="custom-provider">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <h4 className="text-sm font-medium">{t('addCustomProvider')}</h4>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-3">
                    <div className="grid gap-2">
                      <Label htmlFor="custom-name">
                        {t('name')} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="custom-name"
                        placeholder="My Git Server"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="custom-origin">
                        {t('origin')} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="custom-origin"
                        placeholder="https://git.example.com"
                        value={customOrigin}
                        onChange={(e) => setCustomOrigin(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="custom-username">
                        {t('username')} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="custom-username"
                        placeholder="git"
                        value={customUsername}
                        onChange={(e) => setCustomUsername(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="custom-password">
                        {t('password')} <span className="text-destructive">*</span>
                      </Label>
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
                        !customName.trim() ||
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
              <AccordionItem value="git-identity">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <h4 className="text-sm font-medium">{t('gitIdentity')}</h4>
                  </div>
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

          {/* Advanced Settings */}
          <div className="space-y-4">
            <Separator className="my-6" />
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