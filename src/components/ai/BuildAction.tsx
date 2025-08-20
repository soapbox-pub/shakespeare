import { memo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Loader2, XCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BuildActionProps {
  action: 'build' | 'deploy' | 'auto-build' | 'auto-fix';
  result?: string;
  isError?: boolean;
  isLoading?: boolean;
}

export const BuildAction = memo(({ action, result, isError = false, isLoading = false }: BuildActionProps) => {
  const getActionIcon = () => {
    if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (isError) return <XCircle className="h-4 w-4 text-destructive" />;
    return <Play className="h-4 w-4" />;
  };

  const getActionTitle = () => {
    if (action === 'build') return 'Build Project';
    if (action === 'deploy') return 'Deploy Project';
    if (action === 'auto-build') return 'Auto-Build Project';
    if (action === 'auto-fix') return 'Auto-Fix Error';
    return 'Build Action';
  };

  const getActionDescription = () => {
    if (isLoading) {
      if (action === 'build') return 'Building project...';
      if (action === 'deploy') return 'Deploying project...';
      if (action === 'auto-build') return 'Auto-building project...';
      if (action === 'auto-fix') return 'Auto-fixing error...';
      return 'Processing...';
    }

    if (isError) {
      if (action === 'build') return 'Build failed';
      if (action === 'deploy') return 'Deploy failed';
      if (action === 'auto-build') return 'Auto-build failed';
      if (action === 'auto-fix') return 'Auto-fix failed';
      return 'Action failed';
    }

    if (result) {
      if (action === 'build') return 'Build completed';
      if (action === 'deploy') return 'Deploy completed';
      if (action === 'auto-build') return 'Auto-build completed';
      if (action === 'auto-fix') return 'Auto-fix completed';
      return 'Action completed';
    }

    if (action === 'build') return 'Starting build process...';
    if (action === 'deploy') return 'Starting deploy process...';
    if (action === 'auto-build') return 'Starting auto-build process...';
    if (action === 'auto-fix') return 'Starting auto-fix process...';
    return 'Starting action...';
  };

  return (
    <Card className={cn("mt-2", isError ? "border-destructive/50" : "border-muted")}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getActionIcon()}
            <span className="font-mono text-sm font-medium">{getActionTitle()}</span>
          </div>
          <div className="flex items-center gap-2">
            {isLoading ? (
              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Running
              </Badge>
            ) : isError ? (
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
            isError
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