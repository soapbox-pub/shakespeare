import { ReactNode } from 'react';
import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from 'react-error-boundary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { getSentryInstance } from '@/lib/sentry';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((props: FallbackProps) => ReactNode);
  onError?: (error: Error, info: { componentStack: string | null }) => void;
  /** Whether to report errors to Sentry (default: true) */
  reportToSentry?: boolean;
}

/**
 * Default error fallback component
 */
function ErrorFallback({ error }: FallbackProps) {
  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-destructive/10 rounded-full">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-2xl">Something went wrong</CardTitle>
              <CardDescription className="mt-1">
                We encountered an unexpected error. Don't worry, your data is safe.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Details</AlertTitle>
            <AlertDescription className="mt-2 font-mono text-xs break-all">
              {error.message}
            </AlertDescription>
          </Alert>

          {process.env.NODE_ENV === 'development' && error.stack && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium mb-2">
                Stack Trace
              </summary>
              <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-64">
                {error.stack}
              </pre>
            </details>
          )}
        </CardContent>

        <CardFooter className="flex flex-wrap gap-2">
          <Button onClick={handleReload} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Reload Page
          </Button>
          <Button onClick={handleGoHome} variant="outline" className="gap-2">
            <Home className="h-4 w-4" />
            Go Home
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * Error Boundary component that catches React rendering errors and displays a fallback UI.
 * Prevents the entire app from crashing when a component throws an error.
 *
 * Built on top of react-error-boundary for robust error handling.
 */
export function ErrorBoundary({
  children,
  fallback,
  onError,
  reportToSentry = true,
}: ErrorBoundaryProps) {
  const handleError = (error: Error, info: { componentStack: string | null }) => {
    // Log error details for debugging
    console.error('ErrorBoundary caught an error:', error, info);

    // Report to Sentry if enabled
    if (reportToSentry) {
      const Sentry = getSentryInstance();
      if (Sentry) {
        Sentry.captureException(error, {
          level: 'fatal', // Mark as fatal/unhandled error (skull icon in Sentry UI)
          contexts: {
            react: {
              componentStack: info.componentStack,
            },
          },
          tags: {
            errorBoundary: 'true', // Tag to easily filter these errors
          },
        });
      }
    }

    // Call optional error handler
    onError?.(error, info);
  };

  // Determine fallback render
  const fallbackRender = typeof fallback === 'function'
    ? fallback
    : fallback
      ? () => fallback
      : ErrorFallback;

  return (
    <ReactErrorBoundary
      fallbackRender={fallbackRender}
      onError={handleError}
    >
      {children}
    </ReactErrorBoundary>
  );
}
