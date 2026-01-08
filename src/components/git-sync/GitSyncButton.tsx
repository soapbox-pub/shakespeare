import { useState, useEffect, useRef } from 'react';
import { CloudUpload, Loader2, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useGitStatus } from '@/hooks/useGitStatus';
import { useGitSyncState } from '@/hooks/useGitSyncState';
import { useFSPaths } from '@/hooks/useFSPaths';
import { cn } from '@/lib/utils';
import { GitSyncSteps } from './GitSyncSteps';

interface GitSyncButtonProps {
  projectId: string;
  className?: string;
}

export function GitSyncButton({ projectId, className }: GitSyncButtonProps) {
  const [open, setOpen] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [showWarningPopover, setShowWarningPopover] = useState(false);
  const warningDismissed = useRef(false);

  const { data: gitStatus, isLoading: isGitStatusLoading } = useGitStatus(projectId);
  const { getError, getState } = useGitSyncState();
  const { projectsPath } = useFSPaths();

  const dir = `${projectsPath}/${projectId}`;
  const hasError = !!getError(dir);
  const gitSyncState = getState(dir);
  const isGitActionOccurring = gitSyncState?.isActive ?? false;
  const prevIsGitActionOccurring = useRef(isGitActionOccurring);
  const prevProjectId = useRef(projectId);

  // Reset state when projectId changes
  useEffect(() => {
    if (prevProjectId.current !== projectId) {
      setSyncSuccess(false);
      setShowWarningPopover(false);
      warningDismissed.current = false;
      prevIsGitActionOccurring.current = isGitActionOccurring;
      prevProjectId.current = projectId;
    }
  }, [projectId, isGitActionOccurring]);

  // Detect when a git action completes successfully
  useEffect(() => {
    // If we were syncing and now we're not, and there's no error, show success
    if (prevIsGitActionOccurring.current && !isGitActionOccurring && !hasError) {
      setSyncSuccess(true);
      const timer = setTimeout(() => setSyncSuccess(false), 2500);
      return () => clearTimeout(timer);
    }
    prevIsGitActionOccurring.current = isGitActionOccurring;
  }, [isGitActionOccurring, hasError]);

  // Check if we need to show the warning popover
  const needsRemote = !isGitStatusLoading && gitStatus &&
    !gitStatus.remotes.find(r => r.name === 'origin') &&
    gitStatus.totalCommits > 1;

  // Show warning popover when purple indicator is visible (only if not dismissed)
  useEffect(() => {
    if (needsRemote && !warningDismissed.current) {
      setShowWarningPopover(true);
    } else {
      setShowWarningPopover(false);
    }
  }, [needsRemote]);

  // Handle button click - dismiss warning popover permanently
  const handleButtonClick = () => {
    if (showWarningPopover) {
      warningDismissed.current = true;
      setShowWarningPopover(false);
    }
    setOpen(true);
  };

  // Determine which indicator to show (only one at a time, in priority order)
  const renderIndicator = () => {
    // Checkmark: sync just completed successfully - highest priority
    if (syncSuccess) {
      return <IndicatorCheck />;
    }

    // Spinner: git action occurring - second priority
    if (isGitActionOccurring) {
      return <IndicatorSpinner />;
    }

    // Red indicator: error state - second priority
    if (hasError) {
      return <IndicatorDot color="red" />;
    }

    if (isGitStatusLoading || !gitStatus) return null;

    const originRemote = gitStatus.remotes.find(r => r.name === 'origin');
    const hasRemote = !!originRemote;

    const { remoteBranchExists, ahead, behind, totalCommits } = gitStatus;

    // Yellow indicator: unsynced changes (ahead or behind remote) - third priority
    const hasUnsyncedChanges = hasRemote && remoteBranchExists && (ahead > 0 || behind > 0);
    if (hasUnsyncedChanges) {
      return <IndicatorDot color="yellow" />;
    }

    // Purple indicator: no remote configured, but has commits - lowest priority
    if (needsRemote) {
      return <IndicatorDot color="primary" />;
    }

    return null;
  };

  return (
    <>
      {/* Warning popover - shown when purple indicator is visible */}
      <Popover open={showWarningPopover} modal={false}>
        <PopoverTrigger asChild>
          <div className="relative">
            {/* Main Git Sync popover */}
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("size-8 p-0 group relative", className)}
                  aria-label="Sync with Git"
                  onClick={handleButtonClick}
                >
                  <CloudUpload className={cn("size-5 group-hover:text-foreground", open ? "text-foreground" : "text-muted-foreground")} />
                  {renderIndicator()}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-96"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <GitSyncSteps projectId={projectId} onClose={() => setOpen(false)} />
              </PopoverContent>
            </Popover>
          </div>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="center"
          className="w-80 pointer-events-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="space-y-2 pointer-events-auto">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-primary shrink-0" />
              <h4 className="font-semibold text-sm">Your project files are not safe</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Your project files are stored in your browser session and could be deleted. Sync with git to back up your project.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

function IndicatorDot({ color }: { color: 'primary' | 'yellow' | 'red' }) {
  return (
    <span className={cn(
      "absolute top-1 right-1 h-2 w-2 rounded-full",
      {
        'bg-primary': color === 'primary',
        'bg-yellow-500': color === 'yellow',
        'bg-red-500': color === 'red',
      },
    )} />
  );
}

function IndicatorSpinner() {
  return (
    <Loader2 className="absolute top-1 right-1 size-2.5 animate-spin text-blue-600 dark:text-blue-400" />
  );
}

function IndicatorCheck() {
  return (
    <Check className="absolute top-1 right-1 size-2.5 text-green-600 dark:text-green-400" />
  );
}