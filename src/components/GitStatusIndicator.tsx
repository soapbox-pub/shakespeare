import { useGitStatus } from '@/hooks/useGitStatus';
import { cn } from '@/lib/utils';

interface GitStatusIndicatorProps {
  projectId: string | null;
  className?: string;
}

export function GitStatusIndicator({ projectId, className }: GitStatusIndicatorProps) {
  const { data: gitStatus } = useGitStatus(projectId);

  // Only show the indicator if we're in a git repo and have uncommitted changes
  if (!gitStatus?.isGitRepo || !gitStatus?.hasUncommittedChanges) {
    return null;
  }

  return (
    <div
      className={cn(
        "w-2 h-2 bg-yellow-500 rounded-full animate-pulse",
        "shadow-sm shadow-yellow-500/50",
        className
      )}
      title={`${gitStatus.changedFiles.length} uncommitted change${gitStatus.changedFiles.length !== 1 ? 's' : ''}`}
    />
  );
}