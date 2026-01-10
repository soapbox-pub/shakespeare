import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, Plus, Trash2, Zap, Globe, WalletMinimal, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useNWC } from '@/hooks/useNWCContext';
import { useWallet } from '@/hooks/useWallet';
import { useToast } from '@/hooks/useToast';
import { SettingsPageLayout } from '@/components/SettingsPageLayout';

export function WalletSettings() {
  const { t } = useTranslation();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [connectionUri, setConnectionUri] = useState('');
  const [alias, setAlias] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const {
    connections,
    activeConnection,
    connectionInfo,
    addConnection,
    removeConnection,
    setActiveConnection
  } = useNWC();

  const { webln } = useWallet();

  const hasNWC = connections.length > 0 && connections.some(c => c.isConnected);

  const handleAddConnection = async () => {
    if (!connectionUri.trim()) {
      toast({
        title: t('connectionUriRequired'),
        description: t('pleaseEnterValidNwcUri'),
        variant: 'destructive',
      });
      return;
    }

    setIsConnecting(true);
    try {
      const success = await addConnection(connectionUri.trim(), alias.trim() || undefined);
      if (success) {
        setConnectionUri('');
        setAlias('');
        setAddDialogOpen(false);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRemoveConnection = (connectionString: string) => {
    removeConnection(connectionString);
  };

  const handleSetActive = (connectionString: string) => {
    setActiveConnection(connectionString);
    toast({
      title: t('activeWalletChanged'),
      description: t('selectedWalletNowActive'),
    });
  };

  return (
    <SettingsPageLayout
      icon={Wallet}
      titleKey="walletSettings"
      descriptionKey="walletSettingsDescription"
    >
      {/* Current Status */}
      <div className="space-y-3">
        <h3 className="font-medium">{t('currentStatus')}</h3>
        <div className="grid gap-3">
          {/* WebLN */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">WebLN</p>
                <p className="text-xs text-muted-foreground">{t('browserExtension')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {webln && <CheckCircle className="h-4 w-4 text-green-600" />}
              <Badge variant={webln ? "default" : "secondary"} className="text-xs">
                {webln ? t('ready') : t('notFound')}
              </Badge>
            </div>
          </div>
          {/* NWC */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <WalletMinimal className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{t('nostrWalletConnect')}</p>
                <p className="text-xs text-muted-foreground">
                  {connections.length > 0
                    ? t('walletsConnected', { count: connections.length })
                    : t('remoteWalletConnection')
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasNWC && <CheckCircle className="h-4 w-4 text-green-600" />}
              <Badge variant={hasNWC ? "default" : "secondary"} className="text-xs">
                {hasNWC ? t('ready') : t('none')}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* NWC Management */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{t('nostrWalletConnect')}</h3>
          <Button size="sm" variant="outline" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {t('add')}
          </Button>
        </div>

        {/* Connected Wallets List */}
        {connections.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
            <WalletMinimal className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('noWalletsConnected')}</p>
            <p className="text-xs mt-1">{t('addNwcWalletToGetStarted')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {connections.map((connection) => {
              const info = connectionInfo[connection.connectionString];
              const isActive = activeConnection === connection.connectionString;
              return (
                <div 
                  key={connection.connectionString} 
                  className={`flex items-center justify-between p-3 border rounded-lg ${isActive ? 'ring-2 ring-primary' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <WalletMinimal className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {connection.alias || info?.alias || t('lightningWallet')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('nwcConnection')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isActive && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {!isActive && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSetActive(connection.connectionString)}
                        title={t('setAsActive')}
                      >
                        <Zap className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveConnection(connection.connectionString)}
                      title={t('remove')}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Help */}
      {!webln && connections.length === 0 && (
        <>
          <Separator />
          <div className="text-center py-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('installWeblnOrConnectNwc')}
            </p>
          </div>
        </>
      )}

      {/* Add Wallet Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('connectNwcWallet')}</DialogTitle>
            <DialogDescription>
              {t('enterConnectionStringFromWallet')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="alias">{t('walletNameOptional')}</Label>
              <Input
                id="alias"
                placeholder={t('myLightningWallet')}
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="connection-uri">{t('connectionUri')}</Label>
              <Textarea
                id="connection-uri"
                placeholder="nostr+walletconnect://..."
                value={connectionUri}
                onChange={(e) => setConnectionUri(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleAddConnection}
              disabled={isConnecting || !connectionUri.trim()}
              className="w-full"
            >
              {isConnecting ? t('connecting') : t('connect')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsPageLayout>
  );
}

export default WalletSettings;
