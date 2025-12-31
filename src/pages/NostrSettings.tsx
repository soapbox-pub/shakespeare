import { Wifi, Users, UserPlus, LogOut, Trash2, User, Plus, Server, Key } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SettingsPageLayout } from '@/components/SettingsPageLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { RelayListManager } from '@/components/RelayListManager';
import { GraspListManager } from '@/components/GraspListManager';
import SimpleLoginDialog from '@/components/auth/SimpleLoginDialog';
import SimpleSignupDialog from '@/components/auth/SimpleSignupDialog';
import { useLoggedInAccounts, type Account } from '@/hooks/useLoggedInAccounts';
import { genUserName } from '@/lib/genUserName';
import { useState } from 'react';
import { toast } from '@/hooks/useToast';
import { useNostrLogin } from '@nostrify/react/login';

const sanitizeFilename = (filename: string) => {
  return filename.replace(/[^a-z0-9_.-]/gi, '_');
};

export function NostrSettings() {
  const { t } = useTranslation();
  const { authors, currentUser, setLogin, removeLogin, isLoading } = useLoggedInAccounts();
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showSignupDialog, setShowSignupDialog] = useState(false);
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
    <>
      <SettingsPageLayout
        icon={Wifi}
        titleKey="nostrSettings"
        descriptionKey="nostrSettingsDescription"
      >
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
                <div className="border rounded-lg bg-card text-card-foreground shadow-sm overflow-hidden">
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
          <GraspListManager />
        </div>
      </SettingsPageLayout>

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
    </>
  );
}

export default NostrSettings;