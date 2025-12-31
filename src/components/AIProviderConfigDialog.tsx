import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AIProvider } from '@/contexts/AISettingsContext';
import { ExternalFavicon } from '@/components/ExternalFavicon';
import { CreditsBadge } from '@/components/CreditsBadge';

interface AIProviderConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: AIProvider;
  onUpdate: (provider: AIProvider) => void;
  onRemove: () => void;
  onOpenCreditsDialog: () => void;
}

export function AIProviderConfigDialog({
  open,
  onOpenChange,
  provider,
  onUpdate,
  onRemove,
  onOpenCreditsDialog,
}: AIProviderConfigDialogProps) {
  const { t } = useTranslation();
  const [localProvider, setLocalProvider] = useState(provider);

  // Reset local state when provider changes or dialog opens
  useEffect(() => {
    if (open) {
      setLocalProvider(provider);
    }
  }, [provider, open]);

  const handleSave = () => {
    onUpdate(localProvider);
    onOpenChange(false);
  };

  const handleDelete = () => {
    onRemove();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {localProvider.baseURL ? (
              <ExternalFavicon
                url={localProvider.baseURL}
                size={20}
                fallback={<Bot size={20} />}
              />
            ) : (
              <Bot size={20} />
            )}
            <DialogTitle>{localProvider.name}</DialogTitle>
            <div className="ml-auto">
              <CreditsBadge
                provider={localProvider}
                onOpenDialog={onOpenCreditsDialog}
              />
            </div>
          </div>
          <DialogDescription>
            Configure your AI provider settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="provider-name">
              {t('name')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="provider-name"
              placeholder="Provider name"
              value={localProvider.name || ''}
              onChange={(e) => setLocalProvider({ ...localProvider, name: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="provider-baseURL">
              {t('baseUrl')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="provider-baseURL"
              placeholder="https://api.example.com/v1"
              value={localProvider.baseURL || ''}
              onChange={(e) => setLocalProvider({ ...localProvider, baseURL: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="provider-auth">{t('authentication')}</Label>
            <Select
              value={localProvider.nostr ? 'nostr' : 'api-key'}
              onValueChange={(value: 'api-key' | 'nostr') => setLocalProvider({
                ...localProvider,
                nostr: value === 'nostr' || undefined,
                apiKey: value === 'nostr' ? undefined : localProvider.apiKey
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="api-key">{t('apiKey')}</SelectItem>
                <SelectItem value="nostr">Nostr</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!localProvider.nostr && (
            <div className="grid gap-2">
              <Label htmlFor="provider-apiKey">{t('apiKey')}</Label>
              <PasswordInput
                id="provider-apiKey"
                placeholder={t('enterApiKey')}
                value={localProvider.apiKey || ''}
                onChange={(e) => setLocalProvider({ ...localProvider, apiKey: e.target.value })}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="provider-proxy"
              checked={localProvider.proxy || false}
              onCheckedChange={(checked) => setLocalProvider({
                ...localProvider,
                proxy: checked === true || undefined
              })}
            />
            <Label htmlFor="provider-proxy" className="cursor-pointer">
              {t('useCorsProxy')}
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="destructive"
            onClick={handleDelete}
            className="sm:mr-auto"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('delete')}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave}>
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
