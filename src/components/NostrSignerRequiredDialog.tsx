import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface NostrSignerRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NostrSignerRequiredDialog({ open, onOpenChange }: NostrSignerRequiredDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nostr Signer Required</DialogTitle>
          <DialogDescription className="space-y-3">
            <p>
              This page tried to use a NIP-07 signer, but you don't have one installed!
            </p>
            <p>
              Please install a Nostr signer extension to continue:
            </p>
            <div className="space-y-2 mt-4">
              <a
                href="https://github.com/soapbox-pub/soapbox-signer"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-primary hover:underline"
              >
                • Soapbox Signer
              </a>
              <a
                href="https://getalby.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-primary hover:underline"
              >
                • Alby
              </a>
              <a
                href="https://github.com/fiatjaf/nos2x"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-primary hover:underline"
              >
                • nos2x
              </a>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
