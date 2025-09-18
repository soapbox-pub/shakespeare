import { ArrowLeft, Wifi, Users, UserPlus, LogOut, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { RelaySelector } from '@/components/RelaySelector';
import LoginDialog from '@/components/auth/LoginDialog';
import SignupDialog from '@/components/auth/SignupDialog';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useNavigate } from 'react-router-dom';
import { useLoggedInAccounts, type Account } from '@/hooks/useLoggedInAccounts';
import { genUserName } from '@/lib/genUserName';
import { useState } from 'react';

export function NostrSettings() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { authors, currentUser, setLogin, removeLogin } = useLoggedInAccounts();
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
            Back to Settings
          </Button>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Wifi className="h-6 w-6 text-primary" />
              Nostr Settings
            </h1>
            <p className="text-muted-foreground">
              Configure your Nostr connection settings and relay preferences.
            </p>
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="space-y-2">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Wifi className="h-6 w-6 text-primary" />
            Nostr Settings
          </h1>
          <p className="text-muted-foreground">
            Configure your Nostr connection settings and relay preferences.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Account Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Nostr Accounts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {authors.length === 0 ? (
              <div className="text-center py-8">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  No accounts logged in. Add an account to get started.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Button onClick={() => setShowSignupDialog(true)} className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Create Account
                  </Button>
                  <Button variant="outline" onClick={() => setShowLoginDialog(true)} className="gap-2">
                    <LogOut className="h-4 w-4 rotate-180" />
                    Add Existing Account
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Account List */}
                <div className="space-y-3">
                  {authors.map((account) => (
                    <div
                      key={account.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        currentUser?.id === account.id
                          ? 'bg-primary/5 border-primary/20'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={account.metadata?.picture} alt={getDisplayName(account)} />
                        <AvatarFallback>
                          {getDisplayName(account).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">
                            {getDisplayName(account)}
                          </p>
                          {currentUser?.id === account.id && (
                            <Badge variant="secondary" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {account.pubkey.slice(0, 16)}...
                        </p>
                        {account.metadata?.about && (
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {account.metadata.about}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {currentUser?.id !== account.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSwitchAccount(account.id)}
                            className="gap-1"
                          >
                            Switch
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveAccount(account.id)}
                          className="gap-1 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Account Actions */}
                <div className="pt-4 border-t">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowSignupDialog(true)}
                      className="gap-2 flex-1"
                    >
                      <UserPlus className="h-4 w-4" />
                      Create New Account
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowLoginDialog(true)}
                      className="gap-2 flex-1"
                    >
                      <LogOut className="h-4 w-4 rotate-180" />
                      Add Existing Account
                    </Button>
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
              Relay Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <Label htmlFor="relay-selector">Selected Relay</Label>
              <RelaySelector className="w-full max-w-md" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Login Dialog */}
      <LoginDialog
        isOpen={showLoginDialog}
        onClose={() => setShowLoginDialog(false)}
        onLogin={handleLoginSuccess}
        onSignup={() => {
          setShowLoginDialog(false);
          setShowSignupDialog(true);
        }}
      />

      {/* Signup Dialog */}
      <SignupDialog
        isOpen={showSignupDialog}
        onClose={() => setShowSignupDialog(false)}
        onComplete={handleSignupComplete}
      />
    </div>
  );
}

export default NostrSettings;