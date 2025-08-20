import { Badge } from '@/components/ui/badge';
import { Loader2, XCircle, CheckCircle, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ActionStatusProps {
  status?: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PENDING';
  isLoading?: boolean;
  isError?: boolean;
  _result?: string;
  runningIcon?: React.ReactNode;
  successIcon?: React.ReactNode;
  failedIcon?: React.ReactNode;
  successLabel?: string;
  failedLabel?: string;
  runningLabel?: string;
}

export function ActionStatus({
  status,
  isLoading,
  isError,
  _result,
  runningIcon = <Loader2 className="h-3 w-3 animate-spin" />,
  successIcon = <CheckCircle className="h-3 w-3" />,
  failedIcon = <XCircle className="h-3 w-3" />,
  successLabel = 'Success',
  failedLabel = 'Failed',
  runningLabel = 'Running'
}: ActionStatusProps) {
  // Handle both new status-based and old boolean-based props for compatibility
  const effectiveStatus = status || (
    isLoading ? 'RUNNING' :
    isError ? 'FAILED' : 'SUCCESS'
  ) as 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PENDING';

  const getBadge = () => {
    if (effectiveStatus === 'RUNNING') {
      return (
        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
          {runningIcon}
          {runningLabel}
        </Badge>
      );
    }

    if (effectiveStatus === 'FAILED') {
      return (
        <Badge variant="destructive" className="text-xs">
          {failedIcon}
          {failedLabel}
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
        {successIcon}
        {successLabel}
      </Badge>
    );
  };

  const getIcon = (size: 'sm' | 'md' = 'md') => {
    const sizeClass = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

    if (effectiveStatus === 'RUNNING') return <Loader2 className={`${sizeClass} animate-spin`} />;
    if (effectiveStatus === 'FAILED') return <XCircle className={`${sizeClass} text-destructive`} />;
    return <Play className={sizeClass} />;
  };

  const getResultClass = () => {
    return cn(
      "p-3 rounded-md text-sm",
      effectiveStatus === 'FAILED'
        ? "bg-destructive/10 text-destructive border border-destructive/20"
        : "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800/30"
    );
  };

  const getBorderClass = () => {
    return effectiveStatus === 'FAILED' ? "border-destructive/50" : "border-muted";
  };

  return {
    Badge: getBadge,
    Icon: getIcon,
    ResultClass: getResultClass,
    BorderClass: getBorderClass,
    status: effectiveStatus
  };
}