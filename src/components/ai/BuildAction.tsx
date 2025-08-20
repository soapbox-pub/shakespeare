import { memo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Loader2, XCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BuildActionComponentProps } from '@/types/build';

interface BuildActionProps extends BuildActionComponentProps {
  result?: string;
}

export const BuildAction = memo(({ action, result, status, isError, isLoading }: BuildActionProps) => {
  // Handle both new status-based and old boolean-based props for compatibility
  const effectiveStatus = status || (
    isLoading ? 'RUNNING' :
    isError ? 'FAILED' : 'SUCCESS'
  );

  const actionConfig = {
    build: { title: 'Build Project', verb: 'build' },
    deploy: { title: 'Deploy Project', verb: 'deploy' },
    'auto-build': { title: 'Auto-Build Project', verb: 'auto-build' },
  }[action] || { title: 'Build Action', verb: 'process' };

  const getActionIcon = () => {
    if (effectiveStatus === 'RUNNING') return <Loader2 className="h-4 w-4 animate-spin" />;
    if (effectiveStatus === 'FAILED') return <XCircle className="h-4 w-4 text-destructive" />;
    return <Play className="h-4 w-4" />;
  };

  const getActionDescription = () => {
    if (effectiveStatus === 'RUNNING') return `${actionConfig.verb.charAt(0).toUpperCase() + actionConfig.verb.slice(1)}ing project...`;
    if (effectiveStatus === 'FAILED') return `${actionConfig.verb.charAt(0).toUpperCase() + actionConfig.verb.slice(1)} failed`;
    if (effectiveStatus === 'SUCCESS') return `${actionConfig.verb.charAt(0).toUpperCase() + actionConfig.verb.slice(1)} completed`;
    return `Starting ${actionConfig.verb} process...`;
  };

  return (
    <Card className={cn("mt-2", effectiveStatus === 'FAILED' ? "border-destructive/50" : "border-muted")}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getActionIcon()}
            <span className="font-mono text-sm font-medium">{actionConfig.title}</span>
          </div>
          <div className="flex items-center gap-2">
            {effectiveStatus === 'RUNNING' ? (
              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Running
              </Badge>
            ) : effectiveStatus === 'FAILED' ? (
              <Badge variant="destructive" className="text-xs">
                <XCircle className="h-3 w-3 mr-1" />
                Failed
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                <CheckCircle className="h-3 w-3 mr-1" />
                Success
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="text-sm text-muted-foreground mb-3">
          {getActionDescription()}
        </div>

        {result && (
          <div className={cn(
            "p-3 rounded-md text-sm",
            effectiveStatus === 'FAILED'
              ? "bg-destructive/10 text-destructive border border-destructive/20"
              : "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800/30"
          )}>
            <pre className="whitespace-pre-wrap break-words">{result}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

BuildAction.displayName = 'BuildAction';