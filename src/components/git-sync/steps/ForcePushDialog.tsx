import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ForcePushDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  remoteName?: string;
}

export function ForcePushDialog({
  open,
  onOpenChange,
  onConfirm,
  remoteName = 'the remote'
}: ForcePushDialogProps) {
  const handleConfirm = () => {
    onOpenChange(false);
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Force Push - Overwrite Remote History?
          </DialogTitle>
          <DialogDescription className="space-y-3">
            <p>
              This will <strong className="text-destructive">completely overwrite the remote repository</strong> on <strong>{remoteName}</strong> with your local version, permanently deleting any commits and changes on {remoteName} that don't exist locally.
            </p>
            <div className="rounded-md bg-destructive/10 p-3 text-sm border border-destructive/20">
              <p className="font-medium text-destructive mb-1">What will be deleted from {remoteName}:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>All commits on {remoteName} that aren't in your local repository</li>
                <li>Any work by other contributors not in your local copy</li>
                <li>The entire commit history will be replaced with your local history</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground">
              <strong>Warning:</strong> This operation cannot be undone and may affect other collaborators. Only use this if you're certain your local version is correct.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            variant="destructive"
            className="gap-2"
          >
            <AlertTriangle className="h-4 w-4" />
            Force Push
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
