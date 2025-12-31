import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { GitCredential } from '@/contexts/GitSettingsContext';
import { ExternalFavicon } from '@/components/ExternalFavicon';

interface GitCredentialConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credential: GitCredential;
  onUpdate: (credential: GitCredential) => void;
  onRemove: () => void;
  isCustom?: boolean;
}

export function GitCredentialConfigDialog({
  open,
  onOpenChange,
  credential,
  onUpdate,
  onRemove,
  isCustom = false,
}: GitCredentialConfigDialogProps) {
  const { t } = useTranslation();
  const [localCredential, setLocalCredential] = useState(credential);

  // Reset local state when credential changes or dialog opens
  useEffect(() => {
    if (open) {
      setLocalCredential(credential);
    }
  }, [credential, open]);

  const handleSave = () => {
    onUpdate(localCredential);
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
            <ExternalFavicon
              url={localCredential.origin}
              size={20}
              fallback={<GitBranch size={20} />}
            />
            <DialogTitle>{localCredential.name}</DialogTitle>
            {isCustom && <Badge variant="outline">{t('custom')}</Badge>}
          </div>
          <DialogDescription>
            Configure your Git credentials
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="credential-name">
              {t('name')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="credential-name"
              placeholder="GitHub"
              value={localCredential.name}
              onChange={(e) => setLocalCredential({ ...localCredential, name: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="credential-origin">
              {t('origin')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="credential-origin"
              placeholder="https://github.com"
              value={localCredential.origin}
              onChange={(e) => setLocalCredential({ ...localCredential, origin: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="credential-username">
              {t('username')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="credential-username"
              placeholder="git"
              value={localCredential.username}
              onChange={(e) => setLocalCredential({ ...localCredential, username: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="credential-password">
              {t('password')} <span className="text-destructive">*</span>
            </Label>
            <PasswordInput
              id="credential-password"
              placeholder={t('enterPassword')}
              value={localCredential.password}
              onChange={(e) => setLocalCredential({ ...localCredential, password: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
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
