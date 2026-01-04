import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import type { PresetProvider } from '@/lib/aiProviderPresets';

interface OAuthHook {
  isOAuthConfigured: boolean;
  isLoading: boolean;
  error: string | null;
  initiateOAuth: () => void;
}

interface AddAIProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset: PresetProvider;
  isLoggedIntoNostr: boolean;
  oauthHook?: OAuthHook | null;
  forceManualEntry?: boolean;
  onSetForceManualEntry?: (force: boolean) => void;
  onAdd: (apiKey: string) => void;
}

export function AddAIProviderDialog({
  open,
  onOpenChange,
  preset,
  isLoggedIntoNostr,
  oauthHook,
  forceManualEntry = false,
  onSetForceManualEntry,
  onAdd,
}: AddAIProviderDialogProps) {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);

  const showNostrLoginRequired = preset.nostr && !isLoggedIntoNostr;
  const isOAuthConfigured = oauthHook?.isOAuthConfigured ?? false;
  const isOAuthLoading = oauthHook?.isLoading ?? false;
  const oauthError = oauthHook?.error ?? null;

  const handleAdd = () => {
    onAdd(apiKey);
    setApiKey('');
    onOpenChange(false);
  };

  // Reset state when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setApiKey('');
      setTermsAgreed(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ExternalFavicon
              url={preset.baseURL}
              size={20}
              fallback={<Bot size={20} />}
            />
            <DialogTitle>{preset.name}</DialogTitle>
          </div>
          <DialogDescription>
            Add {preset.name} as your AI provider
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
                    <DropdownMenuItem onClick={() => onSetForceManualEntry?.(true)}>
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
            <div className="space-y-3">
              {!preset.nostr && preset.apiKeysURL && (
                <ExternalInput
                  type="password"
                  placeholder={preset.id === "routstr" ? t('enterCashuToken') : t('enterApiKey')}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && apiKey.trim() && termsAgreed) {
                      handleAdd();
                    }
                  }}
                  url={preset.apiKeysURL}
                  urlTitle="Get Key"
                />
              )}

              {/* Terms of Service Agreement */}
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="agree-terms"
                  checked={termsAgreed}
                  onCheckedChange={(checked) => setTermsAgreed(checked === true)}
                  className="size-3 [&_svg]:size-3"
                />
                <label
                  htmlFor="agree-terms"
                  className="text-xs text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {t('agreeToTermsOfService', { providerName: preset.name })}{' '}
                  {preset.tosURL ? (
                    <a
                      href={preset.tosURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground underline hover:text-foreground hover:no-underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t('termsOfService')}
                    </a>
                  ) : (
                    t('termsOfService')
                  )}
                </label>
              </div>
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
                !termsAgreed ||
                (!!preset.apiKeysURL && !apiKey.trim())
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
