import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Rocket, ChevronDown, Key, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExternalInput } from '@/components/ui/external-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExternalFavicon } from '@/components/ExternalFavicon';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { requestBuildServerApiKey } from '@/lib/nip98';

interface PresetProvider {
  id: string;
  type: 'shakespeare' | 'netlify' | 'vercel' | 'nsite' | 'cloudflare' | 'deno' | 'apkbuilder';
  name: string;
  description: string;
  requiresNostr?: boolean;
  apiKeyLabel?: string;
  apiKeyURL?: string;
  accountIdLabel?: string;
  accountIdURL?: string;
  organizationIdLabel?: string;
  organizationIdURL?: string;
  buildServerUrlLabel?: string;
  proxy?: boolean;
}

interface OAuthHook {
  isOAuthConfigured: boolean;
  isLoading: boolean;
  error: string | null;
  initiateOAuth: () => void;
}

interface AddProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset: PresetProvider;
  isLoggedIntoNostr: boolean;
  oauthHook: OAuthHook | null;
  forceManualEntry: boolean;
  onSetForceManualEntry: (force: boolean) => void;
  onAdd: (apiKey: string, accountId?: string, organizationId?: string, buildServerUrl?: string) => void;
}

function getProviderUrl(preset: PresetProvider): string | null {
  switch (preset.type) {
    case 'shakespeare':
      return 'https://shakespeare.diy';
    case 'netlify':
      return 'https://netlify.com';
    case 'vercel':
      return 'https://vercel.com';
    case 'cloudflare':
      return 'https://cloudflare.com';
    case 'deno':
      return 'https://deno.com';
    case 'nsite':
      return null;
    case 'apkbuilder':
      return 'https://android.com';
    default:
      return null;
  }
}

export function AddProviderDialog({
  open,
  onOpenChange,
  preset,
  isLoggedIntoNostr,
  oauthHook,
  forceManualEntry,
  onSetForceManualEntry,
  onAdd,
}: AddProviderDialogProps) {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const [apiKey, setApiKey] = useState('');
  const [accountId, setAccountId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [buildServerUrl, setBuildServerUrl] = useState('');
  const [isGettingApiKey, setIsGettingApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  const showNostrLoginRequired = preset.requiresNostr && !isLoggedIntoNostr;
  const isOAuthConfigured = oauthHook?.isOAuthConfigured ?? false;
  const isOAuthLoading = oauthHook?.isLoading ?? false;
  const oauthError = oauthHook?.error ?? null;

  const handleAdd = () => {
    onAdd(apiKey, accountId, organizationId, buildServerUrl);
    setApiKey('');
    setAccountId('');
    setOrganizationId('');
    setBuildServerUrl('');
    setApiKeyError(null);
    onOpenChange(false);
  };

  const handleGetApiKey = async () => {
    if (!buildServerUrl.trim() || !user?.signer) {
      setApiKeyError('Build server URL and Nostr login required');
      return;
    }

    setIsGettingApiKey(true);
    setApiKeyError(null);

    try {
      const result = await requestBuildServerApiKey(
        user.signer,
        buildServerUrl.trim(),
        preset.proxy ? 'https://corsproxy.io/?' : undefined
      );
      setApiKey(result.apiKey);
    } catch (error) {
      setApiKeyError(error instanceof Error ? error.message : 'Failed to get API key');
    } finally {
      setIsGettingApiKey(false);
    }
  };

  const url = getProviderUrl(preset);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {url ? (
              <ExternalFavicon
                url={url}
                size={20}
                fallback={<Rocket size={20} />}
              />
            ) : (
              <Rocket size={20} />
            )}
            <DialogTitle>{preset.name}</DialogTitle>
          </div>
          <DialogDescription>
            {preset.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
          ) : isOAuthConfigured && !forceManualEntry ? (
            // Show OAuth button if OAuth is configured and not forced to manual
            <div className="space-y-3">
              <div className="flex gap-0">
                <Button
                  onClick={() => oauthHook?.initiateOAuth()}
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
                      {url ? (
                        <ExternalFavicon
                          url={url}
                          size={16}
                          fallback={<Rocket size={16} />}
                        />
                      ) : (
                        <Rocket size={16} />
                      )}
                      <span className="truncate text-ellipsis overflow-hidden">
                        Connect to {preset.name}
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
                    <DropdownMenuItem onClick={() => onSetForceManualEntry(true)}>
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
            // Show manual token input
            <div className="space-y-3">
              {!preset.requiresNostr && preset.type !== 'nsite' && (
                <>
                  {preset.type === 'cloudflare' && (
                    <ExternalInput
                      type="text"
                      placeholder={preset.accountIdLabel || 'Account ID'}
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && apiKey.trim() && accountId.trim()) {
                          handleAdd();
                        }
                      }}
                      url={preset.accountIdURL}
                      urlTitle="Find ID"
                    />
                  )}
                  {preset.type === 'deno' && (
                    <ExternalInput
                      type="text"
                      placeholder={preset.organizationIdLabel || 'Organization ID'}
                      value={organizationId}
                      onChange={(e) => setOrganizationId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && apiKey.trim() && organizationId.trim()) {
                          handleAdd();
                        }
                      }}
                      url={preset.organizationIdURL}
                      urlTitle="Find ID"
                    />
                  )}
                  {preset.type === 'apkbuilder' && (
                    <>
                      <ExternalInput
                        type="text"
                        placeholder={preset.buildServerUrlLabel || 'Build Server URL'}
                        value={buildServerUrl}
                        onChange={(e) => {
                          setBuildServerUrl(e.target.value);
                          setApiKeyError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && apiKey.trim() && buildServerUrl.trim()) {
                            handleAdd();
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <ExternalInput
                          type="password"
                          placeholder={preset.apiKeyLabel || 'API Key'}
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && apiKey.trim() && buildServerUrl.trim()) {
                              handleAdd();
                            }
                          }}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleGetApiKey}
                          disabled={!buildServerUrl.trim() || !user?.signer || isGettingApiKey}
                          className="shrink-0"
                          title={!user?.signer ? 'Login to Nostr first' : 'Get API key using Nostr authentication'}
                        >
                          {isGettingApiKey ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Key className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {apiKeyError && (
                        <p className="text-xs text-destructive">{apiKeyError}</p>
                      )}
                      {!user?.signer && buildServerUrl.trim() && (
                        <p className="text-xs text-muted-foreground">
                          <Link to="/settings/nostr" className="underline">Login to Nostr</Link> to get an API key automatically
                        </p>
                      )}
                    </>
                  )}
                  {preset.type !== 'apkbuilder' && (
                  <ExternalInput
                    type="password"
                    placeholder={preset.apiKeyLabel || t('enterApiKey')}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && apiKey.trim() &&
                        (preset.type !== 'cloudflare' || accountId.trim()) &&
                        (preset.type !== 'deno' || organizationId.trim())) {
                        handleAdd();
                      }
                    }}
                    url={preset.apiKeyURL}
                    urlTitle="Get Key"
                  />
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {!showNostrLoginRequired && !(isOAuthConfigured && !forceManualEntry) && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleAdd}
              disabled={
                (preset.requiresNostr && !isLoggedIntoNostr) ||
                (!preset.requiresNostr && preset.type !== 'nsite' && !apiKey.trim()) ||
                (preset.type === 'cloudflare' && !accountId.trim()) ||
                (preset.type === 'deno' && !organizationId.trim()) ||
                (preset.type === 'apkbuilder' && !buildServerUrl.trim())
              }
            >
              {t('add')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
