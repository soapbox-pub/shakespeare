import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface AddCustomGitCredentialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (credential: {
    name: string;
    origin: string;
    username: string;
    password: string;
  }) => void;
  existingOrigins: string[];
}

export function AddCustomGitCredentialDialog({
  open,
  onOpenChange,
  onAdd,
  existingOrigins,
}: AddCustomGitCredentialDialogProps) {
  const { t } = useTranslation();
  const [customName, setCustomName] = useState('');
  const [customOrigin, setCustomOrigin] = useState('');
  const [customUsername, setCustomUsername] = useState('');
  const [customPassword, setCustomPassword] = useState('');

  const handleAdd = () => {
    if (!customName.trim() || !customOrigin.trim() || !customUsername.trim() || !customPassword.trim()) return;

    onAdd({
      name: customName.trim(),
      origin: customOrigin.trim(),
      username: customUsername.trim(),
      password: customPassword.trim(),
    });

    // Reset form
    setCustomName('');
    setCustomOrigin('');
    setCustomUsername('');
    setCustomPassword('');

    onOpenChange(false);
  };

  const isValid = customName.trim() &&
    customOrigin.trim() &&
    customUsername.trim() &&
    customPassword.trim() &&
    !existingOrigins.includes(customOrigin.trim());

  const originExists = existingOrigins.includes(customOrigin.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('addCustomProvider')}</DialogTitle>
          <DialogDescription>
            Configure a custom Git server with your credentials
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="custom-name">
              {t('name')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="custom-name"
              placeholder="My Git Server"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="custom-origin">
              {t('origin')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="custom-origin"
              placeholder="https://git.example.com"
              value={customOrigin}
              onChange={(e) => setCustomOrigin(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="custom-username">
              {t('username')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="custom-username"
              placeholder="git"
              value={customUsername}
              onChange={(e) => setCustomUsername(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="custom-password">
              {t('password')} <span className="text-destructive">*</span>
            </Label>
            <PasswordInput
              id="custom-password"
              placeholder={t('enterPassword')}
              value={customPassword}
              onChange={(e) => setCustomPassword(e.target.value)}
            />
          </div>

          {originExists && (
            <p className="text-sm text-destructive">
              {t('credentialsExist')}
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
