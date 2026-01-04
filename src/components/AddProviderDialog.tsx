import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Rocket, ChevronDown } from 'lucide-react';
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
import type { PresetDeployProvider } from '@/lib/deploy/types';

interface OAuthHook {
  isOAuthConfigured: boolean;
  isLoading: boolean;
  error: string | null;
  initiateOAuth: () => void;
}

interface AddProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset: PresetDeployProvider;
  isLoggedIntoNostr: boolean;
  oauthHook: OAuthHook | null;
  forceManualEntry: boolean;
  onSetForceManualEntry: (force: boolean) => void;
  onAdd: (apiKey: string, accountId?: string, organizationId?: string) => void;
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
  const [apiKey, setApiKey] = useState('');
  const [accountId, setAccountId] = useState('');
  const [organizationId, setOrganizationId] = useState('');

  const showNostrLoginRequired = preset.requiresNostr && !isLoggedIntoNostr;
  const isOAuthConfigured = oauthHook?.isOAuthConfigured ?? false;
  const isOAuthLoading = oauthHook?.isLoading ?? false;
  const oauthError = oauthHook?.error ?? null;

  const handleAdd = () => {
    onAdd(apiKey, accountId, organizationId);
    setApiKey('');
    setAccountId('');
    setOrganizationId('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ExternalFavicon
              url={preset.baseURL}
              size={20}
              fallback={<Rocket size={20} />}
            />
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
                    <span className="truncate text-ellipsis overflow-hidden">
                      Connect to {preset.name}
                    </span>
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
                (preset.type === 'deno' && !organizationId.trim())
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
