import { Loader2 } from 'lucide-react';
import { useProjectSessionStatus } from '@/hooks/useProjectSessionStatus';
import { cn } from '@/lib/utils';

interface ProjectSessionIndicatorProps {
  projectId: string;
  className?: string;
}

/**
 * Small indicator that shows if a project has active AI sessions
 */
export function ProjectSessionIndicator({ projectId, className }: ProjectSessionIndicatorProps) {
  const { hasActiveSessions, hasRunningSessions } = useProjectSessionStatus(projectId);

  if (!hasActiveSessions) {
    return null;
  }

  return (
    <div className={cn("flex items-center", className)}>
      {hasRunningSessions ? (
        <Loader2 className="h-3 w-3 animate-spin text-blue-600 dark:text-blue-400" />
      ) : (
        <div className="h-2 w-2 rounded-full bg-green-500" title="AI session active" />
      )}
    </div>
  );
}