import { useState } from 'react';
import { CloudUpload } from 'lucide-react';
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

  const { data: gitStatus, isLoading: isGitStatusLoading } = useGitStatus(projectId);
  const { getError } = useGitSyncState();
  const { projectsPath } = useFSPaths();

  const dir = `${projectsPath}/${projectId}`;
  const hasError = !!getError(dir);

  // Determine which indicator to show (only one at a time, in priority order)
  const renderIndicator = () => {
    // Red indicator: error state - highest priority
    if (hasError) {
      return <IndicatorDot color="red" />;
    }

    if (isGitStatusLoading || !gitStatus) return null;

    const originRemote = gitStatus.remotes.find(r => r.name === 'origin');
    const hasRemote = !!originRemote;

    const { remoteBranchExists, ahead, behind, totalCommits } = gitStatus;

    // Yellow indicator: unsynced changes (ahead or behind remote) - second priority
    const hasUnsyncedChanges = hasRemote && remoteBranchExists && (ahead > 0 || behind > 0);
    if (hasUnsyncedChanges) {
      return <IndicatorDot color="yellow" />;
    }

    // Purple indicator: no remote configured, but has commits - lowest priority
    const needsRemote = !hasRemote && totalCommits >= 2;
    if (needsRemote) {
      return <IndicatorDot color="primary" />;
    }

    return null;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("size-8 p-0 group relative", className)}
          aria-label="Sync with Git"
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