import { Loader2 } from 'lucide-react';
import { useProjectSessionStatus } from '@/hooks/useProjectSessionStatus';
import { cn } from '@/lib/utils';

interface ProjectSessionIndicatorProps {
  projectId: string;
  className?: string;
}

/**
 * Small indicator that shows if a project has active AI sessions
 * Positioned as a status badge on the folder icon
 */
export function ProjectSessionIndicator({ projectId, className }: ProjectSessionIndicatorProps) {
  const { hasActiveSessions, hasRunningSessions } = useProjectSessionStatus(projectId);

  if (!hasActiveSessions) {
    return null;
  }

  return (
    <div className={cn(
      "absolute -bottom-0.5 -right-0.5 flex items-center justify-center",
      "bg-background border border-border rounded-full shadow-sm",
      className
    )}>
      {hasRunningSessions ? (
        <Loader2 className="h-2.5 w-2.5 animate-spin text-blue-600 dark:text-blue-400" />
      ) : (
        <div className="h-1.5 w-1.5 rounded-full bg-green-500" title="AI session active" />
      )}
    </div>
  );
}