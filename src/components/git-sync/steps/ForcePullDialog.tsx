import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ForcePullDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ForcePullDialog({ open, onOpenChange, onConfirm }: ForcePullDialogProps) {
  const handleConfirm = () => {
    onOpenChange(false);
    onConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Force Pull - Discard Local Changes?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              This will <strong className="text-destructive">permanently discard all local changes</strong> and reset your repository to match the remote.
            </p>
            <p className="text-sm">
              This action cannot be undone. Any uncommitted work will be lost.
            </p>
            <div className="rounded-md bg-destructive/10 p-3 text-sm border border-destructive/20">
              <p className="font-medium text-destructive mb-1">What will happen:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>All local changes will be discarded</li>
                <li>Repository will reset to remote state</li>
                <li>Latest changes will be pulled from remote</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive hover:bg-destructive/90"
          >
            <AlertTriangle className="h-4 w-4" />
            Force Pull
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
