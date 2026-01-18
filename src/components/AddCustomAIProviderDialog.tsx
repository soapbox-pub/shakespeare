import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
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

interface AddCustomAIProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (provider: AIProvider) => void;
  existingIds: string[];
}

// Helper function to generate ID from name
function generateIdFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

export function AddCustomAIProviderDialog({
  open,
  onOpenChange,
  onAdd,
  existingIds,
}: AddCustomAIProviderDialogProps) {
  const { t } = useTranslation();
  const [customProviderName, setCustomProviderName] = useState('');
  const [customProviderId, setCustomProviderId] = useState('');
  const [customIdManuallyEdited, setCustomIdManuallyEdited] = useState(false);
  const [customBaseURL, setCustomBaseURL] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customAuthMethod, setCustomAuthMethod] = useState<'api-key' | 'nostr' | 'opensecret'>('api-key');
  const [customOpenSecretUrl, setCustomOpenSecretUrl] = useState('');
  const [customProxy, setCustomProxy] = useState(false);

  const handleAdd = () => {
    if (!customProviderName.trim() || !customProviderId.trim() || !customBaseURL.trim()) return;

    const provider: AIProvider = {
      id: customProviderId.trim(),
      name: customProviderName.trim(),
      baseURL: customBaseURL.trim(),
    };

    if (customAuthMethod === 'api-key' && customApiKey.trim()) {
      provider.apiKey = customApiKey.trim();
    } else if (customAuthMethod === 'nostr') {
      provider.nostr = true;
    } else if (customAuthMethod === 'opensecret') {
      provider.openSecret = customOpenSecretUrl.trim();
      if (customApiKey.trim()) {
        provider.apiKey = customApiKey.trim();
      }
    }

    if (customProxy) {
      provider.proxy = true;
    }

    onAdd(provider);

    // Reset form
    setCustomProviderName('');
    setCustomProviderId('');
    setCustomIdManuallyEdited(false);
    setCustomBaseURL('');
    setCustomApiKey('');
    setCustomAuthMethod('api-key');
    setCustomOpenSecretUrl('');
    setCustomProxy(false);

    onOpenChange(false);
  };

  const isValid = customProviderName.trim() &&
    customProviderId.trim() &&
    customBaseURL.trim() &&
    (customAuthMethod !== 'opensecret' || customOpenSecretUrl.trim()) &&
    !existingIds.includes(customProviderId.trim());

  const idExists = existingIds.includes(customProviderId.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('addCustomProvider')}</DialogTitle>
          <DialogDescription>
            Configure a custom AI provider with your own settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="custom-name">
                {t('name')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="custom-name"
                placeholder="e.g., My Custom API"
                value={customProviderName}
                onChange={(e) => {
                  const newName = e.target.value;
                  setCustomProviderName(newName);

                  // Auto-generate ID from name if ID hasn't been manually edited
                  if (!customIdManuallyEdited) {
                    setCustomProviderId(generateIdFromName(newName));
                  }
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="custom-id">
                {t('id')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="custom-id"
                placeholder="e.g., my-custom-api"
                value={customProviderId}
                onChange={(e) => {
                  setCustomProviderId(e.target.value);
                  setCustomIdManuallyEdited(true);
                }}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="custom-baseurl">
              {t('baseUrl')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="custom-baseurl"
              placeholder="https://api.example.com/v1"
              value={customBaseURL}
              onChange={(e) => setCustomBaseURL(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="custom-auth">{t('authentication')}</Label>
            <Select
              value={customAuthMethod}
              onValueChange={(value: 'api-key' | 'nostr' | 'opensecret') => {
                setCustomAuthMethod(value);
                if (value === 'nostr') {
                  setCustomApiKey(''); // Clear API key when switching to Nostr auth
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="api-key">{t('apiKey')}</SelectItem>
                <SelectItem value="nostr">Nostr</SelectItem>
                <SelectItem value="opensecret">OpenSecret</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {customAuthMethod === 'opensecret' && (
            <div className="grid gap-2">
              <Label htmlFor="custom-opensecret-url">
                OpenSecret API URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="custom-opensecret-url"
                placeholder="https://enclave.trymaple.ai"
                value={customOpenSecretUrl}
                onChange={(e) => setCustomOpenSecretUrl(e.target.value)}
              />
            </div>
          )}

          {(customAuthMethod === 'api-key' || customAuthMethod === 'opensecret') && (
            <div className="grid gap-2">
              <Label htmlFor="custom-apikey">{t('apiKey')}</Label>
              <PasswordInput
                id="custom-apikey"
                placeholder={t('enterApiKey') + ' (optional)'}
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="custom-proxy"
              checked={customProxy}
              onCheckedChange={(checked) => setCustomProxy(checked === true)}
            />
            <Label htmlFor="custom-proxy" className="cursor-pointer">
              {t('useCorsProxy')}
            </Label>
          </div>

          {idExists && (
            <p className="text-sm text-destructive">
              {t('providerExists')}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleAdd} disabled={!isValid}>
            <Check className="h-4 w-4 mr-2" />
            {t('addCustomProviderButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
