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

interface CloudflareProject {
  id: string;
  name: string;
  subdomain: string;
  domains: string[];
  production_branch: string;
  created_on: string;
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
  const [projects, setProjects] = useState<CloudflareProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState<string>('');
  const [newProjectName, setNewProjectName] = useState(projectName || projectId);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const url = `${baseURL}/accounts/${accountId}/pages/projects`;
      const targetUrl = corsProxy ? proxyUrl(corsProxy, url) : url;

      const response = await fetch(targetUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setProjects(data.result || []);

      // If there's a saved project name and it exists in the list, select it
      // Otherwise leave it empty (showing placeholder)
      if (savedProjectName && data.result?.some((p: CloudflareProject) => p.name === savedProjectName)) {
        setSelectedProjectName(savedProjectName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, accountId, baseURL, savedProjectName, corsProxy]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

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

  const selectedProject = projects.find(p => p.name === selectedProjectName);

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="cloudflare-project">Select Project</Label>
        <Select value={selectedProjectName} onValueChange={setSelectedProjectName}>
          <SelectTrigger id="cloudflare-project">
            <SelectValue placeholder="Select a project or create new..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create new project
              </div>
            </SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.name}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedProjectName === 'new' ? (
        <div className="space-y-2">
          <Label htmlFor="new-project-name">New Project Name</Label>
          <Input
            id="new-project-name"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder={projectName || projectId}
          />
          <p className="text-xs text-muted-foreground">
            Domain: <span className="font-mono">{newProjectName || projectId}.pages.dev</span>
          </p>
          <p className="text-xs text-muted-foreground">
            A new project will be created when you deploy
          </p>
        </div>
      ) : selectedProject ? (
        <div className="space-y-2">
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{selectedProject.name}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  https://{selectedProject.subdomain}.pages.dev
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => window.open(`https://dash.cloudflare.com/pages/${selectedProject.id}`, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Deployment will update this existing project
          </p>
        </div>
      ) : null}
    </div>
  );
}
