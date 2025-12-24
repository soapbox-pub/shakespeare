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
  remoteName?: string;
}

export function ForcePullDialog({
  open,
  onOpenChange,
  onConfirm,
  remoteName = 'the remote'
}: ForcePullDialogProps) {
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
              This will <strong className="text-destructive">completely reset your local repository</strong> to match the repository pushed to <strong>{remoteName}</strong>, permanently deleting all local commits and changes that don't exist on {remoteName}.
            </p>
            <div className="rounded-md bg-destructive/10 p-3 text-sm border border-destructive/20">
              <p className="font-medium text-destructive mb-1">What will be deleted:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>All local commits that haven't been pushed to {remoteName}</li>
                <li>Any work not available on {remoteName}</li>
                <li>All uncommitted changes</li>
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
