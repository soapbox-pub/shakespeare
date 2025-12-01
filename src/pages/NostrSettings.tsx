import { ArrowLeft, Wifi, Users, UserPlus, LogOut, Trash2, User, Plus, Server, X, Key } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { RelayListManager } from '@/components/RelayListManager';
import SimpleLoginDialog from '@/components/auth/SimpleLoginDialog';
import SimpleSignupDialog from '@/components/auth/SimpleSignupDialog';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useNavigate } from 'react-router-dom';
import { useLoggedInAccounts, type Account } from '@/hooks/useLoggedInAccounts';
import { genUserName } from '@/lib/genUserName';
import { useState } from 'react';
import { useAppContext } from '@/hooks/useAppContext';
import { toast } from '@/hooks/useToast';
import { useNostrLogin } from '@nostrify/react/login';

const sanitizeFilename = (filename: string) => {
  return filename.replace(/[^a-z0-9_.-]/gi, '_');
};

export function NostrSettings() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { authors, currentUser, setLogin, removeLogin, isLoading } = useLoggedInAccounts();
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showSignupDialog, setShowSignupDialog] = useState(false);
  const { config, updateConfig } = useAppContext();
  const [newServerHostname, setNewServerHostname] = useState('');
  const { logins } = useNostrLogin();

  const handleSwitchAccount = (accountId: string) => {
    setLogin(accountId);
  };

  const handleRemoveAccount = (accountId: string) => {
    removeLogin(accountId);
  };

  const handleLoginSuccess = () => {
    setShowLoginDialog(false);
  };

  const handleSignupComplete = () => {
    setShowSignupDialog(false);
  };

  const getDisplayName = (account: Account) => {
    return account.metadata?.name ?? genUserName(account.pubkey);
  };

  const handleAddServer = () => {
    const hostname = newServerHostname.trim();
    if (!hostname) return;

    // Basic validation - check if it's a valid hostname format
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-_.]*[a-zA-Z0-9]$/.test(hostname)) {
      return;
    }

    updateConfig((current) => ({
      ...current,
      ngitServers: [...(current.ngitServers ?? config.ngitServers), hostname],
    }));

    setNewServerHostname('');
  };

  const handleRemoveServer = (hostname: string) => {
    updateConfig((current) => ({
      ...current,
      ngitServers: (current.ngitServers ?? config.ngitServers).filter(s => s !== hostname),
    }));
  };

  const getAccountLogin = (accountId: string) => {
    return logins.find((l) => l.id === accountId);
  };

  const isNsecLogin = (accountId: string) => {
    const login = getAccountLogin(accountId);
    return login?.type === 'nsec';
  };

  const getAccountNsec = (accountId: string): string | undefined => {
    const login = getAccountLogin(accountId);
    if (login?.type === 'nsec' && login.data && 'nsec' in login.data) {
      return login.data.nsec as string;
    }
    return undefined;
  };

  const downloadNsec = (accountId: string) => {
    const nsec = getAccountNsec(accountId);
    if (!nsec) return;

    try {
      // Create a blob with the key text
      const blob = new Blob([nsec], { type: 'text/plain; charset=utf-8' });
      const url = globalThis.URL.createObjectURL(blob);

      // Sanitize filename
      const filename = sanitizeFilename('secret-key.txt');

      // Create a temporary link element and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      // Clean up immediately
      globalThis.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Secret Key Saved!',
        description: 'Your key has been safely stored.',
      });
    } catch {
      toast({
        title: 'Download failed',
        description: 'Could not download the key file.',
        variant: 'destructive',
      });
    }
  };

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
              <Wifi className="h-6 w-6 text-primary" />
              {t('nostrSettings')}
            </h1>
            <p className="text-muted-foreground">
              {t('nostrSettingsDescription')}
            </p>
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="space-y-2">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Wifi className="h-6 w-6 text-primary" />
            {t('nostrSettings')}
          </h1>
          <p className="text-muted-foreground">
            {t('nostrSettingsDescription')}
          </p>
        </div>
      )}

      <div className="space-y-6 max-w-xl">
        {/* Account Management */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">{t('nostrAccounts')}</h3>
          </div>
          <div className="space-y-4">
            {isLoading ? (
              <div className="border rounded-lg overflow-hidden">
                {/* Loading skeleton for accounts */}
                <div className="flex items-center gap-3 p-3 border-b last:border-b-0">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
                {/* Add account button skeleton */}
                <div className="flex items-center gap-3 p-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </div>
            ) : authors.length === 0 ? (
              <div className="text-center py-8">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  {t('noAccountsLoggedIn')}
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Button onClick={() => setShowSignupDialog(true)} className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    {t('createAccount')}
                  </Button>
                  <Button variant="outline" onClick={() => setShowLoginDialog(true)} className="gap-2">
                    <LogOut className="h-4 w-4 rotate-180" />
                    {t('addExistingAccount')}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Account List - Joined Together */}
                <div className="border rounded-lg overflow-hidden">
                  {authors.map((account) => (
                    <div
                      key={account.id}
                      className={`flex items-center gap-3 p-3 transition-colors relative border-b ${
                        currentUser?.id === account.id
                          ? 'bg-primary/5 border-primary/20'
                          : 'hover:bg-muted/50 cursor-pointer'
                      }`}
                      onClick={() => currentUser?.id !== account.id && handleSwitchAccount(account.id)}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={account.metadata?.picture} alt={getDisplayName(account)} />
                        <AvatarFallback>
                          {getDisplayName(account).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {getDisplayName(account)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 z-10">
                        {isNsecLogin(account.id) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadNsec(account.id);
                            }}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-transparent"
                            title="Download secret key"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveAccount(account.id);
                          }}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-transparent"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Add Account Button - Integrated into the list */}
                  <div
                    className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/50 cursor-pointer"
                    onClick={() => setShowLoginDialog(true)}
                  >
                    <div className="h-10 w-10 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-muted-foreground">
                        {t('addAccount')}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <Separator />

        {/* Relay Configuration */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">{t('relayConfiguration')}</h3>
          </div>
          <RelayListManager />
        </div>

        <Separator />

        {/* Nostr Git Servers */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">{t('nostrGitServers')}</h3>
          </div>
          <div className="space-y-4">
            {/* Server List */}
            <div className="space-y-2">
              {config.ngitServers.map((hostname) => (
                <div
                  key={hostname}
                  className="flex items-center gap-2 p-2 rounded-md border bg-muted/20"
                >
                  <Server className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-mono text-sm flex-1 truncate">
                    {hostname}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveServer(hostname)}
                    className="size-5 text-muted-foreground hover:text-destructive hover:bg-transparent shrink-0"
                    disabled={config.ngitServers.length <= 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Add Server Form */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="new-server-hostname" className="sr-only">
                  {t('serverHostname')}
                </Label>
                <Input
                  id="new-server-hostname"
                  placeholder={t('enterHostname')}
                  value={newServerHostname}
                  onChange={(e) => setNewServerHostname(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddServer();
                    }
                  }}
                />
              </div>
              <Button
                onClick={handleAddServer}
                disabled={!newServerHostname.trim()}
                variant="outline"
                size="sm"
                className="h-10 shrink-0"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('addServer')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Login Dialog */}
      <SimpleLoginDialog
        isOpen={showLoginDialog}
        onClose={() => setShowLoginDialog(false)}
        onLogin={handleLoginSuccess}
        onSignup={() => {
          setShowLoginDialog(false);
          setShowSignupDialog(true);
        }}
      />

      {/* Signup Dialog */}
      <SimpleSignupDialog
        isOpen={showSignupDialog}
        onClose={() => setShowSignupDialog(false)}
        onComplete={handleSignupComplete}
        onLogin={() => {
          setShowSignupDialog(false);
          setShowLoginDialog(true);
        }}
      />
    </div>
  );
}

export default NostrSettings;