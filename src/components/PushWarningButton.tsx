import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GitDialog } from '@/components/GitDialog';
import { AlertTriangle, Upload, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGitStatus } from '@/hooks/useGitStatus';
import { useNavigate } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PushWarningButtonProps {
  projectId: string;
  className?: string;
  variant?: 'icon' | 'full';
}

export function PushWarningButton({ 
  projectId, 
  className,
  variant = 'icon' 
}: PushWarningButtonProps) {
  const [isGitDialogOpen, setIsGitDialogOpen] = useState(false);
  const { data: gitStatus } = useGitStatus(projectId);
  const navigate = useNavigate();

  if (!gitStatus?.isGitRepo) {
    return null;
  }

  // Determine warning state
  const hasNoRemote = gitStatus.remotes.length === 0;
  const hasUncommittedChanges = gitStatus.hasUncommittedChanges;
  const hasCommitsAhead = gitStatus.ahead > 0;

  // Don't show if everything is synced
  if (!hasNoRemote && !hasUncommittedChanges && !hasCommitsAhead) {
    return null;
  }

  // Determine icon and message
  let icon = AlertTriangle;
  let message = '';
  let action = '';

  if (hasNoRemote) {
    icon = GitBranch;
    message = 'No remote configured';
    action = 'Configure remote to prevent data loss';
  } else if (hasCommitsAhead) {
    icon = Upload;
    message = `${gitStatus.ahead} commit${gitStatus.ahead !== 1 ? 's' : ''} not pushed`;
    action = 'Push to remote';
  } else if (hasUncommittedChanges) {
    icon = AlertTriangle;
    message = `${gitStatus.changedFiles.length} uncommitted change${gitStatus.changedFiles.length !== 1 ? 's' : ''}`;
    action = 'Commit and push your changes';
  }

  const Icon = icon;

  const handleClick = () => {
    if (hasNoRemote) {
      // If no remote, open git dialog to configure
      setIsGitDialogOpen(true);
    } else {
      // If remote exists, open git dialog for push/commit
      setIsGitDialogOpen(true);
    }
  };

  if (variant === 'icon') {
    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClick}
                className={cn(
                  "h-8 w-8 p-0",
                  hasNoRemote && "text-yellow-600 hover:text-yellow-700 dark:text-yellow-500 dark:hover:text-yellow-400",
                  hasCommitsAhead && "text-blue-600 hover:text-blue-700 dark:text-blue-500 dark:hover:text-blue-400",
                  hasUncommittedChanges && !hasCommitsAhead && "text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400",
                  className
                )}
              >
                <Icon className="h-4 w-4 animate-pulse" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p className="font-medium">{message}</p>
                <p className="text-xs text-muted-foreground">{action}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <GitDialog
          projectId={projectId}
          open={isGitDialogOpen}
          onOpenChange={setIsGitDialogOpen}
        />
      </>
    );
  }

  // Full button variant
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        className={cn(
          "gap-2 border-2",
          hasNoRemote && "border-yellow-500/50 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-950/20 dark:hover:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400",
          hasCommitsAhead && "border-blue-500/50 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/30 text-blue-700 dark:text-blue-400",
          hasUncommittedChanges && !hasCommitsAhead && "border-amber-500/50 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-400",
          className
        )}
      >
        <Icon className="h-4 w-4 animate-pulse" />
        <span className="text-sm font-medium">{message}</span>
      </Button>

      <GitDialog
        projectId={projectId}
        open={isGitDialogOpen}
        onOpenChange={setIsGitDialogOpen}
      />
    </>
  );
}
