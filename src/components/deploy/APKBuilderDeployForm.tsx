import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { proxyUrl } from '@/lib/proxyUrl';

interface APKBuilderDeployFormProps {
  buildServerUrl: string;
  apiKey: string;
  projectId: string;
  projectName?: string;
  savedAppName?: string;
  savedPackageId?: string;
  onConfigChange: (appName: string, packageId: string) => void;
  corsProxy?: string;
}

interface ServerHealth {
  status: 'ok' | 'error';
  version?: string;
  queue?: {
    running: number;
    queued: number;
  };
}

export function APKBuilderDeployForm({
  buildServerUrl,
  apiKey,
  projectId,
  projectName,
  savedAppName,
  savedPackageId,
  onConfigChange,
  corsProxy,
}: APKBuilderDeployFormProps) {
  const [appName, setAppName] = useState(savedAppName || projectName || projectId);
  const [packageId, setPackageId] = useState(savedPackageId || '');
  const [packageIdError, setPackageIdError] = useState<string | null>(null);
  const [serverHealth, setServerHealth] = useState<ServerHealth | null>(null);
  const [isCheckingServer, setIsCheckingServer] = useState(true);

  // Generate default package ID from project name
  useEffect(() => {
    if (!savedPackageId && !packageId) {
      const safeName = (projectName || projectId)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      setPackageId(`com.app.${safeName}`);
    }
  }, [projectName, projectId, savedPackageId, packageId]);

  // Check server health
  const checkServerHealth = useCallback(async () => {
    setIsCheckingServer(true);
    try {
      const url = `${buildServerUrl}/health`;
      const targetUrl = corsProxy ? proxyUrl(corsProxy, url) : url;

      const response = await fetch(targetUrl, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setServerHealth({ status: 'ok', ...data });
      } else {
        setServerHealth({ status: 'error' });
      }
    } catch {
      setServerHealth({ status: 'error' });
    } finally {
      setIsCheckingServer(false);
    }
  }, [buildServerUrl, apiKey, corsProxy]);

  useEffect(() => {
    checkServerHealth();
  }, [checkServerHealth]);

  // Validate package ID
  const validatePackageId = (value: string): boolean => {
    // Android package ID rules:
    // - Must have at least two segments (e.g., com.example)
    // - Each segment must start with a letter
    // - Can only contain letters, numbers, and underscores
    const pattern = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;
    return pattern.test(value);
  };

  // Handle package ID change with validation
  const handlePackageIdChange = (value: string) => {
    setPackageId(value);
    if (value && !validatePackageId(value)) {
      setPackageIdError('Package ID must be like "com.example.myapp" (letters, numbers, underscores)');
    } else {
      setPackageIdError(null);
    }
  };

  // Notify parent of config changes
  useEffect(() => {
    if (appName && packageId && !packageIdError) {
      onConfigChange(appName, packageId);
    }
  }, [appName, packageId, packageIdError, onConfigChange]);

  return (
    <div className="space-y-4">
      {/* Server Status */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center gap-2">
          {isCheckingServer ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : serverHealth?.status === 'ok' ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium">
              {isCheckingServer
                ? 'Checking build server...'
                : serverHealth?.status === 'ok'
                  ? 'Build server connected'
                  : 'Build server unavailable'}
            </p>
            {serverHealth?.status === 'ok' && serverHealth.queue && (
              <p className="text-xs text-muted-foreground">
                {serverHealth.queue.running > 0
                  ? `${serverHealth.queue.running} build(s) in progress`
                  : 'Ready to build'}
                {serverHealth.queue.queued > 0 && `, ${serverHealth.queue.queued} queued`}
              </p>
            )}
          </div>
        </div>
      </div>

      {serverHealth?.status === 'error' && (
        <Alert variant="destructive">
          <AlertDescription>
            Cannot connect to build server. Check your server URL and API key in Deploy Settings.
          </AlertDescription>
        </Alert>
      )}

      {/* App Name */}
      <div className="space-y-2">
        <Label htmlFor="app-name">App Name</Label>
        <Input
          id="app-name"
          value={appName}
          onChange={(e) => setAppName(e.target.value)}
          placeholder="My App"
        />
        <p className="text-xs text-muted-foreground">
          This name appears on the Android home screen
        </p>
      </div>

      {/* Package ID */}
      <div className="space-y-2">
        <Label htmlFor="package-id">Package ID</Label>
        <Input
          id="package-id"
          value={packageId}
          onChange={(e) => handlePackageIdChange(e.target.value)}
          placeholder="com.example.myapp"
          className={packageIdError ? 'border-red-500' : ''}
        />
        {packageIdError ? (
          <p className="text-xs text-red-500">{packageIdError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Unique identifier for your app (e.g., com.yourcompany.appname)
          </p>
        )}
      </div>

      {/* Build Info */}
      <div className="rounded-lg bg-muted/50 p-3 space-y-1">
        <p className="text-xs text-muted-foreground">
          <strong>Build type:</strong> Debug APK (sideloading)
        </p>
        <p className="text-xs text-muted-foreground">
          <strong>Output:</strong> Downloadable .apk file
        </p>
        <p className="text-xs text-muted-foreground">
          App icon will be auto-detected from your project
        </p>
      </div>
    </div>
  );
}
