import { useState } from 'react';
import { CloudUpload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useGitStatus } from '@/hooks/useGitStatus';
import { cn } from '@/lib/utils';
import { GitSyncSteps } from './GitSyncSteps';

interface GitSyncButtonProps {
  projectId: string;
  className?: string;
}

export function GitSyncButton({ projectId, className }: GitSyncButtonProps) {
  const [open, setOpen] = useState(false);

  const { data: gitStatus, isLoading: isGitStatusLoading } = useGitStatus(projectId);

  // Determine if we have a remote configured
  const originRemote = gitStatus?.remotes.find(r => r.name === 'origin');
  const hasRemote = !!originRemote;

  // Determine if we need to show the indicator dot
  // Show indicator if no origin remote is configured, UNLESS there are less than 2 commits
  const showIndicator = !isGitStatusLoading && !hasRemote && (gitStatus?.totalCommits ?? 0) >= 2;

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
          {showIndicator && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
          )}
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
