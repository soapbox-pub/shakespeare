import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Rocket, ArrowLeft, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useDeploySettings } from '@/hooks/useDeploySettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useNavigate, Link } from 'react-router-dom';
import type { DeployProvider } from '@/contexts/DeploySettingsContext';

interface PresetProvider {
  id: string;
  type: 'shakespeare' | 'netlify' | 'vercel';
  name: string;
  description: string;
  requiresNostr?: boolean;
  apiKeyLabel?: string;
  apiKeyURL?: string;
}

const PRESET_PROVIDERS: PresetProvider[] = [
  {
    id: 'shakespeare',
    type: 'shakespeare',
    name: 'Shakespeare Deploy',
    description: 'Deploy to Shakespeare hosting with Nostr authentication',
    requiresNostr: true,
  },
  {
    id: 'netlify',
    type: 'netlify',
    name: 'Netlify',
    description: 'Deploy to Netlify with personal access token',
    apiKeyLabel: 'Personal Access Token',
    apiKeyURL: 'https://app.netlify.com/user/applications#personal-access-tokens',
  },
  {
    id: 'vercel',
    type: 'vercel',
    name: 'Vercel',
    description: 'Deploy to Vercel with access token',
    apiKeyLabel: 'Access Token',
    apiKeyURL: 'https://vercel.com/account/tokens',
  },
];

export function DeploySettings() {
  const { t } = useTranslation();
  const { settings, setProvider, removeProvider } = useDeploySettings();
  const { user } = useCurrentUser();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const [presetApiKeys, setPresetApiKeys] = useState<Record<string, string>>({});
  const [presetBaseURLs, setPresetBaseURLs] = useState<Record<string, string>>({});

  const handleAddPresetProvider = (preset: PresetProvider) => {
    // For Shakespeare, just check if user is logged in
    if (preset.requiresNostr && !user) {
      return;
    }

    const apiKey = presetApiKeys[preset.id];
    const baseURL = presetBaseURLs[preset.id];

    // For non-Shakespeare providers, require API key
    if (!preset.requiresNostr && !apiKey?.trim()) {
      return;
    }

    let newProvider: DeployProvider;

    if (preset.type === 'shakespeare') {
      newProvider = {
        id: preset.id,
        type: 'shakespeare',
        ...(baseURL?.trim() && { baseURL: baseURL.trim() }),
      };
    } else if (preset.type === 'netlify') {
      newProvider = {
        id: preset.id,
        type: 'netlify',
        apiKey: apiKey.trim(),
        ...(baseURL?.trim() && { baseURL: baseURL.trim() }),
      };
    } else {
      newProvider = {
        id: preset.id,
        type: 'vercel',
        apiKey: apiKey.trim(),
        ...(baseURL?.trim() && { baseURL: baseURL.trim() }),
      };
    }

    setProvider(newProvider);

    // Clear inputs
    setPresetApiKeys(prev => ({ ...prev, [preset.id]: '' }));
    setPresetBaseURLs(prev => ({ ...prev, [preset.id]: '' }));
  };

  const handleRemoveProvider = (id: string) => {
    removeProvider(id);
  };

  const handleUpdateProvider = (provider: DeployProvider) => {
    setProvider(provider);
  };

  const configuredProviderIds = settings.providers.map(p => p.id);
  const availablePresets = PRESET_PROVIDERS.filter(preset => !configuredProviderIds.includes(preset.id));

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
              <Rocket className="h-6 w-6 text-primary" />
              {t('deploySettings')}
            </h1>
            <p className="text-muted-foreground">
              {t('deploySettingsDescriptionLong')}
            </p>
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="space-y-2">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Rocket className="h-6 w-6 text-primary" />
            {t('deploySettings')}
          </h1>
          <p className="text-muted-foreground">
            {t('deploySettingsDescriptionLong')}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Configured Providers */}
        {settings.providers.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">{t('configuredProviders')}</h4>
            <Accordion type="multiple" className="w-full space-y-2">
              {settings.providers.map((provider) => {
                const preset = PRESET_PROVIDERS.find(p => p.id === provider.id);

                return (
                  <AccordionItem key={provider.id} value={provider.id} className="border rounded-lg">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center justify-between w-full mr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {preset?.name || provider.id}
                          </span>
                          {provider.type === 'shakespeare' && (
                            <Badge variant="outline">Nostr</Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveProvider(provider.id);
                          }}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-transparent"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-3">
                        {provider.type === 'shakespeare' ? (
                          <>
                            <p className="text-sm text-muted-foreground">
                              {t('shakespeareDeployNostrAuth')}
                            </p>
                            <div className="grid gap-2">
                              <Label htmlFor={`${provider.id}-baseURL`}>
                                Base URL (Optional)
                              </Label>
                              <Input
                                id={`${provider.id}-baseURL`}
                                placeholder="https://api.example.com"
                                value={provider.baseURL || ''}
                                onChange={(e) => handleUpdateProvider({ ...provider, baseURL: e.target.value })}
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="grid gap-2">
                              <Label htmlFor={`${provider.id}-apiKey`}>
                                {preset?.apiKeyLabel || t('apiKey')}
                              </Label>
                              <PasswordInput
                                id={`${provider.id}-apiKey`}
                                placeholder={t('enterApiKey')}
                                value={provider.apiKey}
                                onChange={(e) => {
                                  if (provider.type === 'netlify') {
                                    handleUpdateProvider({ ...provider, apiKey: e.target.value });
                                  } else if (provider.type === 'vercel') {
                                    handleUpdateProvider({ ...provider, apiKey: e.target.value });
                                  }
                                }}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor={`${provider.id}-baseURL`}>
                                Base URL (Optional)
                              </Label>
                              <Input
                                id={`${provider.id}-baseURL`}
                                placeholder="https://api.example.com"
                                value={provider.baseURL || ''}
                                onChange={(e) => {
                                  if (provider.type === 'netlify') {
                                    handleUpdateProvider({ ...provider, baseURL: e.target.value });
                                  } else if (provider.type === 'vercel') {
                                    handleUpdateProvider({ ...provider, baseURL: e.target.value });
                                  }
                                }}
                              />
                            </div>
                          </>
                        )}
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
            <Accordion type="multiple" className="w-full space-y-2">
              {availablePresets.map((preset) => {
                const isNostrPreset = preset.requiresNostr;
                const isLoggedIntoNostr = !!user;
                const showNostrLoginRequired = isNostrPreset && !isLoggedIntoNostr;

                return (
                  <AccordionItem key={preset.id} value={preset.id} className="border rounded-lg">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center justify-between w-full mr-3">
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-medium">{preset.name}</span>
                          <span className="text-xs text-muted-foreground font-normal">
                            {preset.description}
                          </span>
                        </div>
                        {preset.apiKeyURL && (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground underline hover:text-foreground whitespace-nowrap ml-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(preset.apiKeyURL, '_blank');
                            }}
                          >
                            {t('getApiKey')}
                          </button>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {showNostrLoginRequired ? (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {t('loginToNostrRequired')}
                          </p>
                          <Button asChild className="w-full">
                            <Link to="/settings/nostr">
                              {t('goToNostrSettings')}
                            </Link>
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {!preset.requiresNostr && (
                            <div className="grid gap-2">
                              <Label htmlFor={`preset-${preset.id}-apiKey`}>
                                {preset.apiKeyLabel || t('apiKey')}
                              </Label>
                              <PasswordInput
                                id={`preset-${preset.id}-apiKey`}
                                placeholder={t('enterApiKey')}
                                value={presetApiKeys[preset.id] || ''}
                                onChange={(e) => setPresetApiKeys(prev => ({
                                  ...prev,
                                  [preset.id]: e.target.value,
                                }))}
                              />
                            </div>
                          )}

                          <div className="grid gap-2">
                            <Label htmlFor={`preset-${preset.id}-baseURL`}>
                              Base URL (Optional)
                            </Label>
                            <Input
                              id={`preset-${preset.id}-baseURL`}
                              placeholder="https://api.example.com"
                              value={presetBaseURLs[preset.id] || ''}
                              onChange={(e) => setPresetBaseURLs(prev => ({
                                ...prev,
                                [preset.id]: e.target.value,
                              }))}
                            />
                          </div>

                          <Button
                            onClick={() => handleAddPresetProvider(preset)}
                            disabled={
                              (preset.requiresNostr && !isLoggedIntoNostr) ||
                              (!preset.requiresNostr && !presetApiKeys[preset.id]?.trim())
                            }
                            className="w-full gap-2"
                          >
                            <Check className="h-4 w-4" />
                            {t('add')}
                          </Button>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}
      </div>
    </div>
  );
}

export default DeploySettings;
