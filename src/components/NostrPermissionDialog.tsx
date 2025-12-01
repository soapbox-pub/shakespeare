import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface NostrPermissionDialogProps {
  open: boolean;
  onResponse: (granted: boolean) => void;
}

export function NostrPermissionDialog({ open, onResponse }: NostrPermissionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        onResponse(false);
      }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Allow Nostr Access?</DialogTitle>
          <DialogDescription className="space-y-3">
            <p>
              This project is requesting access to your Nostr signer (window.nostr).
            </p>
            <Alert variant="destructive">
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                Granting access will allow this app to take actions on your behalf, including:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Read your public key</li>
                  <li>Sign events (publish posts, reactions, etc.)</li>
                  <li>Encrypt and decrypt messages</li>
                </ul>
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
              Only grant access if you trust this application.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onResponse(false)}
          >
            Deny
          </Button>
          <Button
            onClick={() => onResponse(true)}
          >
            Allow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
