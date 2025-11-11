import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { GitBranch, Upload, AlertTriangle, X } from 'lucide-react';
import { useGitStatus } from '@/hooks/useGitStatus';
import { useNavigate } from 'react-router-dom';
import { GitDialog } from '@/components/GitDialog';

interface PushReminderDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDisableReminders: () => void;
  onDismiss: () => void;
}

export function PushReminderDialog({
  projectId,
  open,
  onOpenChange,
  onDisableReminders,
  onDismiss,
}: PushReminderDialogProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isGitDialogOpen, setIsGitDialogOpen] = useState(false);
  const { data: gitStatus } = useGitStatus(projectId);
  const navigate = useNavigate();

  // Close the reminder dialog when git dialog opens
  useEffect(() => {
    if (isGitDialogOpen) {
      onOpenChange(false);
      onDismiss();
    }
  }, [isGitDialogOpen, onOpenChange, onDismiss]);

  if (!gitStatus?.isGitRepo) {
    return null;
  }

  const hasNoRemote = gitStatus.remotes.length === 0;
  const hasCommitsAhead = gitStatus.ahead > 0;
  const hasUncommittedChanges = gitStatus.hasUncommittedChanges;

  const handleDismiss = () => {
    if (dontShowAgain) {
      onDisableReminders();
    }
    onDismiss();
    onOpenChange(false);
  };

  const handlePrimaryAction = () => {
    if (dontShowAgain) {
      onDisableReminders();
    }
    
    if (hasNoRemote) {
      // Close reminder dialog and open git dialog
      onOpenChange(false);
      setIsGitDialogOpen(true);
    } else {
      // Close reminder dialog and open git dialog for push
      onOpenChange(false);
      setIsGitDialogOpen(true);
    }
  };

  // Determine dialog content based on git status
  let icon = AlertTriangle;
  let iconColor = 'text-amber-600 dark:text-amber-500';
  let title = '';
  let description = '';
  let primaryActionLabel = '';

  if (hasNoRemote) {
    icon = GitBranch;
    iconColor = 'text-yellow-600 dark:text-yellow-500';
    title = 'No Remote Repository Configured';
    description = 'Your work is only stored locally in your browser. Configure a remote repository to prevent data loss if you clear your browser data.';
    primaryActionLabel = 'Configure Remote';
  } else if (hasCommitsAhead) {
    icon = Upload;
    iconColor = 'text-blue-600 dark:text-blue-500';
    title = 'Unpushed Commits';
    description = `You have ${gitStatus.ahead} commit${gitStatus.ahead !== 1 ? 's' : ''} that ${gitStatus.ahead !== 1 ? 'haven\'t' : 'hasn\'t'} been pushed to your remote repository. Push your changes to prevent data loss.`;
    primaryActionLabel = 'Push Changes';
  } else if (hasUncommittedChanges) {
    icon = AlertTriangle;
    iconColor = 'text-amber-600 dark:text-amber-500';
    title = 'Uncommitted Changes';
    description = `You have ${gitStatus.changedFiles.length} uncommitted change${gitStatus.changedFiles.length !== 1 ? 's' : ''}. Commit and push your changes to keep your work safe.`;
    primaryActionLabel = 'Commit & Push';
  }

  const Icon = icon;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className={`rounded-full p-2 bg-muted ${iconColor}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-left">{title}</DialogTitle>
                <DialogDescription className="text-left mt-2">
                  {description}
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 -mt-1"
                onClick={handleDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 border">
            <Checkbox
              id="dont-show"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="dont-show"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Don't show this again
              </Label>
              <p className="text-xs text-muted-foreground">
                You can re-enable push reminders in Settings &gt; Preferences
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleDismiss}
              className="w-full sm:w-auto"
            >
              Remind Me Later
            </Button>
            <Button
              onClick={handlePrimaryAction}
              className="w-full sm:w-auto"
            >
              {primaryActionLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Git Dialog - opened when user clicks primary action */}
      <GitDialog
        projectId={projectId}
        open={isGitDialogOpen}
        onOpenChange={setIsGitDialogOpen}
      />
    </>
  );
}
