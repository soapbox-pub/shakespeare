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

interface ForcePullDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  remoteName: string;
}

export function ForcePullDialog({
  open,
  onOpenChange,
  onConfirm,
  remoteName,
}: ForcePullDialogProps) {
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
            Force Pull - Discard Local Changes?
          </DialogTitle>
          <DialogDescription className="space-y-3">
            <p>
              This will <strong className="text-destructive">completely reset your local repository</strong> to match the repository pushed to <strong>{remoteName}</strong>, permanently deleting all local commits and changes that don't exist on {remoteName}.
            </p>
            <div className="rounded-md bg-destructive/10 p-3 text-sm border border-destructive/20">
              <p className="font-medium text-destructive mb-1">What will be deleted:</p>
              <ul className="list-disc list-outside space-y-1 text-muted-foreground ml-5">
                <li>All local commits that haven't been pushed to {remoteName}</li>
                <li>Any work not available on {remoteName}</li>
                <li>All uncommitted changes</li>
              </ul>
            </div>
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
            Force Pull
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
