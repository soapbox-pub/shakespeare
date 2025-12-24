import { Errors as GitErrors } from 'isomorphic-git';
import { AlertTriangle, X, ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SyncStepErrorProps {
  error: Error;
  onDismiss: () => void;
  onForcePull: () => void;
  onForcePush: () => void;
  onPull: () => void;
}

export function SyncStepError({ error, onDismiss, onForcePull, onForcePush, onPull }: SyncStepErrorProps) {
  const renderForcePullButton = () => (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        onDismiss();
        onForcePull();
      }}
      className="w-full hover:bg-destructive-foreground/20 border-destructive-foreground/20"
    >
      <AlertTriangle className="h-4 w-4" />
      Force Pull
    </Button>
  );

  const renderForcePushButton = () => (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        onDismiss();
        onForcePush();
      }}
      className="w-full hover:bg-destructive-foreground/20 border-destructive-foreground/20"
    >
      <AlertTriangle className="h-4 w-4" />
      Force Push
    </Button>
  );

  const renderDismissButton = () => (
    <Button
      variant="ghost"
      size="icon"
      className="size-5 shrink-0 hover:bg-destructive-foreground/10"
      onClick={onDismiss}
    >
      <X className="size-4" />
    </Button>
  );

  // MergeNotSupportedError - offer force pull or force push
  if (error instanceof GitErrors.MergeNotSupportedError) {
    return (
      <Alert variant="destructive">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <AlertDescription className="text-sm flex-1">
              Cannot merge changes automatically. Your local changes conflict with the remote repository.
            </AlertDescription>
            {renderDismissButton()}
          </div>
          <div className="flex gap-2">
            {renderForcePullButton()}
            {renderForcePushButton()}
          </div>
        </div>
      </Alert>
    );
  }

  // FastForwardError - offer force pull or force push
  if (error instanceof GitErrors.FastForwardError) {
    return (
      <Alert variant="destructive">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <AlertDescription className="text-sm flex-1">
              Cannot fast-forward. The remote has changes that conflict with your local commits.
            </AlertDescription>
            {renderDismissButton()}
          </div>
          <div className="flex gap-2">
            {renderForcePullButton()}
            {renderForcePushButton()}
          </div>
        </div>
      </Alert>
    );
  }

  // PushRejectedError - remote has changes
  if (error instanceof GitErrors.PushRejectedError) {
    return (
      <Alert variant="destructive">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <AlertDescription className="text-sm flex-1">
              Push rejected. The remote repository has changes you don't have locally. Try pulling first.
            </AlertDescription>
            {renderDismissButton()}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onDismiss();
                onPull();
              }}
            >
              <ArrowDown className="h-4 w-4" />
              Pull First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onDismiss();
                onForcePush();
              }}
              className="hover:bg-destructive-foreground/20 border-destructive-foreground/20"
            >
              <ArrowUp className="h-4 w-4" />
              Force Push
            </Button>
          </div>
        </div>
      </Alert>
    );
  }

  // HTTP errors
  if (error instanceof GitErrors.HttpError) {
    let message: string;

    switch (error.data.statusCode) {
      case 401:
        message = 'Authentication failed. Please check your credentials.';
        break;
      case 403:
        message = 'Access forbidden. You do not have permission to access this repository.';
        break;
      default:
        message = `HTTP Error: ${error.data.statusCode} ${error.data.statusMessage}`;
    }

    return (
      <Alert variant="destructive">
        <div className="flex items-start justify-between gap-2">
          <AlertDescription className="text-sm flex-1">
            {message}
          </AlertDescription>
          {renderDismissButton()}
        </div>
      </Alert>
    );
  }

  // Generic error fallback
  return (
    <Alert variant="destructive">
      <div className="flex items-start justify-between gap-2">
        <AlertDescription className="text-sm flex-1">{error.message}</AlertDescription>
        {renderDismissButton()}
      </div>
    </Alert>
  );
}
