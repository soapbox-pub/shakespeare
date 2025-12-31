import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GitBranch, ChevronDown } from 'lucide-react';
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

interface PresetProvider {
  id: string;
  name: string;
  origin: string;
  username: string;
  tokenURL?: string;
}

interface OAuthHook {
  initiateOAuth: () => void;
  isLoading: boolean;
  error: string | null;
  isOAuthConfigured: boolean;
}

interface AddGitCredentialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset: PresetProvider;
  oauthHook: OAuthHook | null;
  forceManualEntry: boolean;
  onSetForceManualEntry: (force: boolean) => void;
  onAdd: (token: string) => void;
}

export function AddGitCredentialDialog({
  open,
  onOpenChange,
  preset,
  oauthHook,
  forceManualEntry,
  onSetForceManualEntry,
  onAdd,
}: AddGitCredentialDialogProps) {
  const { t } = useTranslation();
  const [token, setToken] = useState('');

  const isOAuthConfigured = oauthHook?.isOAuthConfigured ?? false;
  const isOAuthLoading = oauthHook?.isLoading ?? false;
  const oauthError = oauthHook?.error ?? null;

  const handleAdd = () => {
    onAdd(token);
    setToken('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ExternalFavicon
              url={preset.origin}
              size={20}
              fallback={<GitBranch size={20} />}
            />
            <DialogTitle>{preset.name}</DialogTitle>
          </div>
          <DialogDescription>
            Add {preset.name} credentials for Git operations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {preset.id === 'github' && isOAuthConfigured && !forceManualEntry ? (
            // Special rendering for GitHub OAuth
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
            // Standard token input
            <ExternalInput
              type="password"
              placeholder={t('enterToken')}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && token.trim()) {
                  handleAdd();
                }
              }}
              url={preset.tokenURL}
              urlTitle="Get Token"
            />
          )}
        </div>

        {!(preset.id === 'github' && isOAuthConfigured && !forceManualEntry) && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleAdd} disabled={!token.trim()}>
              {t('add')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
