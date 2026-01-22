import { Errors as GitErrors } from 'isomorphic-git';
import { X, ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import { getSentryInstance } from '@/lib/sentry';

interface SyncStepErrorProps {
  error: Error;
  onDismiss: () => void;
  onForcePull?: () => void;
  onForcePush: () => void;
  onPull?: () => void;
  remoteUrl?: URL;
  remoteName: string;
  /** Context for error messages - 'sync' for existing remotes, 'configure' for initial setup */
  context?: 'sync' | 'configure';
}

export function SyncStepError({ error, onDismiss, onForcePull, onForcePush, onPull, remoteName, remoteUrl, context = 'sync' }: SyncStepErrorProps) {
  const renderForcePullButton = () => (
    <Button
      variant="outline"
      size="sm"
      onClick={onForcePull}
      className="w-full hover:bg-destructive-foreground/20 border-destructive-foreground/20"
    >
      <ArrowDown className="size-4" />
      Force Pull
    </Button>
  );

  const renderForcePushButton = () => (
    <Button
      variant="outline"
      size="sm"
      onClick={onForcePush}
      className="w-full hover:bg-destructive-foreground/20 border-destructive-foreground/20"
    >
      <ArrowUp className="size-4" />
      Force Push
    </Button>
  );

  const renderPullButton = () => (
    <Button
      variant="outline"
      size="sm"
      onClick={onPull}
    >
      <ArrowDown className="size-4" />
      Pull
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
    // Different message based on context
    const message = context === 'configure'
      ? `The repository on ${remoteName} is not empty. You'll need to force push to overwrite it with your local project.`
      : `Push rejected. The remote repository has changes you don't have locally. Try pulling first.`;

    return (
      <Alert variant="destructive">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <AlertDescription className="text-sm flex-1">
              {message}
            </AlertDescription>
            {renderDismissButton()}
          </div>
          <div className="flex gap-2">
            {/* Only show Pull button in sync context (not during initial configure) */}
            {context === 'sync' && onPull && renderPullButton()}
            {renderForcePushButton()}
          </div>
        </div>
      </Alert>
    );
  }

  // HTTP errors
  if (error instanceof GitErrors.HttpError) {
    let message: React.ReactNode = `HTTP Error: ${error.data.statusCode} ${error.data.statusMessage}`;

    // Check if remoteUrl is a Nostr URL
    if (remoteUrl?.protocol === 'nostr:') {
      // This should never happen
      getSentryInstance()?.captureException(error);
      message = `There was an HTTP (${error.data.statusCode}) error communicating with Nostr Git servers.`
    } else if (remoteUrl && remoteUrl.protocol !== 'http:' && remoteUrl.protocol !== 'https:') {
      // Handle standard HTTP errors based on status code
      switch (error.data.statusCode) {
        case 401:
          message = context === 'configure'
            ? <>Your credentials for {remoteName} are invalid or expired. Please check your login in <Link to="/settings/git" className="underline">Git Settings</Link>.</>
            : <>Your API token for {remoteName} is probably invalid or expired. Please try logging out and back into {remoteName} in <Link to="/settings/git" className="underline">Git Settings</Link>.</>;
          break;
        case 403:
          message = context === 'configure'
            ? <>You don't have permission to push to this repository on {remoteName}. Make sure the repository exists and you have write access.</>
            : <>You don't have permission to access this repository on {remoteName}. Try checking your permissions on <a href={remoteUrl.origin} target="_blank" className="underline">{remoteName}</a>.</>;
          break;
        case 404:
          if (context === 'configure') {
            message = <>Repository not found on {remoteName}. Make sure you've created the repository first and the URL is correct.</>;
          }
          break;
      }
    } else {
      // No remoteUrl available or it's a standard HTTP/HTTPS URL
      switch (error.data.statusCode) {
        case 401:
          message = <>Your credentials for {remoteName} are invalid or expired. Please check your login in <Link to="/settings/git" className="underline">Git Settings</Link>.</>;
          break;
        case 403:
          message = <>You don't have permission to push to this repository on {remoteName}. Make sure the repository exists and you have write access.</>;
          break;
        case 404:
          if (context === 'configure') {
            message = <>Repository not found on {remoteName}. Make sure you've created the repository first and the URL is correct.</>;
          }
          break;
      }
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
        <AlertDescription className="text-sm flex-1 whitespace-pre overflow-x-auto">
          {error.message}
        </AlertDescription>
        {renderDismissButton()}
      </div>
    </Alert>
  );
}
