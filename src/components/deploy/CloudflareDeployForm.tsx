import { useState, useEffect, useCallback } from 'react';
import { Plus, ExternalLink } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { proxyUrl } from '@/lib/proxyUrl';

interface CloudflareWorkerScript {
  id: string;
  etag: string;
  handlers: string[];
  modified_on: string;
  created_on: string;
  has_assets: boolean;
}

interface CloudflareDeployFormProps {
  apiKey: string;
  accountId: string;
  baseURL?: string;
  projectId: string;
  projectName?: string;
  savedProjectName?: string;
  onProjectChange: (projectName: string) => void;
  corsProxy?: string;
}

export function CloudflareDeployForm({
  apiKey,
  accountId,
  baseURL = 'https://api.cloudflare.com/client/v4',
  projectId,
  projectName,
  savedProjectName,
  onProjectChange,
  corsProxy,
}: CloudflareDeployFormProps) {
  const [workers, setWorkers] = useState<CloudflareWorkerScript[]>([]);
  const [workersSubdomain, setWorkersSubdomain] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState<string>('');
  const [newProjectName, setNewProjectName] = useState(projectName || projectId);

  const fetchWorkersData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch workers subdomain and workers list in parallel
      const subdomainUrl = `${baseURL}/accounts/${accountId}/workers/subdomain`;
      const workersUrl = `${baseURL}/accounts/${accountId}/workers/scripts`;

      const [subdomainResponse, workersResponse] = await Promise.all([
        fetch(corsProxy ? proxyUrl(corsProxy, subdomainUrl) : subdomainUrl, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        }),
        fetch(corsProxy ? proxyUrl(corsProxy, workersUrl) : workersUrl, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        }),
      ]);

      if (!subdomainResponse.ok) {
        throw new Error(`Failed to fetch workers subdomain: ${subdomainResponse.status} ${subdomainResponse.statusText}`);
      }

      if (!workersResponse.ok) {
        throw new Error(`Failed to fetch workers: ${workersResponse.status} ${workersResponse.statusText}`);
      }

      const [subdomainData, workersData] = await Promise.all([
        subdomainResponse.json(),
        workersResponse.json(),
      ]);

      setWorkersSubdomain(subdomainData.result?.subdomain || null);
      setWorkers(workersData.result || []);

      // If there's a saved project name and it exists in the list, select it
      // Otherwise leave it empty (showing placeholder)
      if (savedProjectName && workersData.result?.some((w: CloudflareWorkerScript) => w.id === savedProjectName)) {
        setSelectedProjectName(savedProjectName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workers data');
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, accountId, baseURL, savedProjectName, corsProxy]);

  useEffect(() => {
    fetchWorkersData();
  }, [fetchWorkersData]);

  // Update newProjectName when switching to "new" if it's empty
  useEffect(() => {
    if (selectedProjectName === 'new' && !newProjectName) {
      setNewProjectName(projectName || projectId);
    }
  }, [selectedProjectName, newProjectName, projectName, projectId]);

  useEffect(() => {
    if (selectedProjectName === '') {
      // No selection yet - don't call onProjectChange
      return;
    } else if (selectedProjectName === 'new') {
      onProjectChange(newProjectName);
    } else {
      onProjectChange(selectedProjectName);
    }
  }, [selectedProjectName, newProjectName, onProjectChange]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Project</Label>
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  const selectedWorker = workers.find(w => w.id === selectedProjectName);

  // Construct the URL preview
  const getWorkerUrl = (scriptName: string) => {
    if (workersSubdomain) {
      return `https://${scriptName}.${workersSubdomain}.workers.dev`;
    }
    return `https://${scriptName}.<subdomain>.workers.dev`;
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="cloudflare-project">Select Worker</Label>
        <Select value={selectedProjectName} onValueChange={setSelectedProjectName}>
          <SelectTrigger id="cloudflare-project">
            <SelectValue placeholder="Select a worker or create new..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create new worker
              </div>
            </SelectItem>
            {workers.map((worker) => (
              <SelectItem key={worker.id} value={worker.id}>
                {worker.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedProjectName === 'new' ? (
        <div className="space-y-2">
          <Label htmlFor="new-project-name">New Worker Name</Label>
          <Input
            id="new-project-name"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder={projectName || projectId}
          />
          <p className="text-xs text-muted-foreground">
            URL: <span className="font-mono">{getWorkerUrl(newProjectName || projectId)}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            A new worker will be created when you deploy
          </p>
        </div>
      ) : selectedWorker ? (
        <div className="space-y-2">
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{selectedWorker.id}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {getWorkerUrl(selectedWorker.id)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => window.open(`https://dash.cloudflare.com/${accountId}/workers/services/view/${selectedWorker.id}`, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Deployment will update this existing worker
          </p>
        </div>
      ) : null}
    </div>
  );
}
