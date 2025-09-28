import { ArrowLeft, Wifi, Users, UserPlus, LogOut, Trash2, User, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { RelaySelector } from '@/components/RelaySelector';
import SimpleLoginDialog from '@/components/auth/SimpleLoginDialog';
import SimpleSignupDialog from '@/components/auth/SimpleSignupDialog';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useNavigate } from 'react-router-dom';
import { useLoggedInAccounts, type Account } from '@/hooks/useLoggedInAccounts';
import { genUserName } from '@/lib/genUserName';
import { useState } from 'react';

export function NostrSettings() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { authors, currentUser, setLogin, removeLogin, isLoading } = useLoggedInAccounts();
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showSignupDialog, setShowSignupDialog] = useState(false);

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
              {t('nostrSettingsDescriptionLong')}
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
            {t('nostrSettingsDescriptionLong')}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Account Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('nostrAccounts')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>

        {/* Relay Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              {t('relayConfiguration')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <Label htmlFor="relay-selector">{t('selectedRelay')}</Label>
              <RelaySelector className="w-full max-w-md" />
            </div>
          </CardContent>
        </Card>
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