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

interface Workspace {
  id: string;
  name: string;
  projects: {
    edges: Array<{
      node: Project;
    }>;
  };
}

interface Project {
  id: string;
  name: string;
  environments: {
    edges: Array<{
      node: {
        id: string;
        name: string;
      };
    }>;
  };
  services: {
    edges: Array<{
      node: {
        id: string;
        name: string;
      };
    }>;
  };
}

interface RailwayDeployFormProps {
  apiKey: string;
  baseURL?: string;
  projectId: string;
  projectName?: string;
  savedWorkspaceId?: string;
  savedProjectId?: string;
  savedEnvironmentId?: string;
  savedServiceId?: string;
  onConfigChange: (config: {
    workspaceId: string;
    projectId: string;
    environmentId: string;
    serviceId: string;
    projectName?: string;
  }) => void;
  corsProxy?: string;
}

export function RailwayDeployForm({
  apiKey,
  baseURL = 'https://backboard.railway.com',
  projectId,
  projectName,
  savedWorkspaceId,
  savedProjectId,
  savedEnvironmentId,
  savedServiceId,
  onConfigChange,
  corsProxy,
}: RailwayDeployFormProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [newProjectName, setNewProjectName] = useState(projectName || projectId);

  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const query = `
        query UserWorkspaces {
          me {
            workspaces {
              id
              name
              projects(first: 500) {
                edges {
                  node {
                    id
                    name
                    environments {
                      edges {
                        node {
                          id
                          name
                        }
                      }
                    }
                    services {
                      edges {
                        node {
                          id
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const url = `${baseURL}/graphql/v2`;
      const targetUrl = corsProxy ? proxyUrl({ template: corsProxy, url }) : url;

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch workspaces: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.errors) {
        throw new Error(`Railway API error: ${result.errors[0]?.message || 'Unknown error'}`);
      }

      const workspacesData: Workspace[] = result.data.me.workspaces;
      setWorkspaces(workspacesData);

      // Auto-select workspace if saved or if there's only one
      if (savedWorkspaceId && workspacesData.some(w => w.id === savedWorkspaceId)) {
        setSelectedWorkspaceId(savedWorkspaceId);
      } else if (workspacesData.length === 1) {
        setSelectedWorkspaceId(workspacesData[0].id);
      }

      // Auto-select project if saved
      if (savedProjectId) {
        setSelectedProjectId(savedProjectId);
      }

      // Auto-select environment if saved
      if (savedEnvironmentId) {
        setSelectedEnvironmentId(savedEnvironmentId);
      }

      // Auto-select service if saved
      if (savedServiceId) {
        setSelectedServiceId(savedServiceId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workspaces');
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, baseURL, savedWorkspaceId, savedProjectId, savedEnvironmentId, savedServiceId, corsProxy]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Update newProjectName when switching to "new" if it's empty
  useEffect(() => {
    if (selectedProjectId === 'new' && !newProjectName) {
      setNewProjectName(projectName || projectId);
    }
  }, [selectedProjectId, newProjectName, projectName, projectId]);

  // Notify parent of configuration changes
  useEffect(() => {
    if (!selectedWorkspaceId || !selectedProjectId) {
      return;
    }

    if (selectedProjectId === 'new') {
      // Creating new project - only require workspace and project name
      onConfigChange({
        workspaceId: selectedWorkspaceId,
        projectId: '',
        environmentId: '',
        serviceId: '',
        projectName: newProjectName,
      });
    } else {
      // Existing project - require environment and service
      if (!selectedEnvironmentId || !selectedServiceId) {
        return;
      }
      onConfigChange({
        workspaceId: selectedWorkspaceId,
        projectId: selectedProjectId,
        environmentId: selectedEnvironmentId,
        serviceId: selectedServiceId === 'new' ? '' : selectedServiceId,
      });
    }
  }, [selectedWorkspaceId, selectedProjectId, selectedEnvironmentId, selectedServiceId, newProjectName, onConfigChange]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Workspace</Label>
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Project</Label>
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  const selectedWorkspace = workspaces.find(w => w.id === selectedWorkspaceId);
  const projects = selectedWorkspace?.projects.edges.map(e => e.node) || [];
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const environments = selectedProject?.environments.edges.map(e => e.node) || [];
  const services = selectedProject?.services.edges.map(e => e.node) || [];

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Workspace Selection */}
      <div className="space-y-2">
        <Label htmlFor="railway-workspace">Workspace</Label>
        <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
          <SelectTrigger id="railway-workspace">
            <SelectValue placeholder="Select a workspace..." />
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((workspace) => (
              <SelectItem key={workspace.id} value={workspace.id}>
                {workspace.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Project Selection */}
      {selectedWorkspaceId && (
        <div className="space-y-2">
          <Label htmlFor="railway-project">Project</Label>
          <Select 
            value={selectedProjectId} 
            onValueChange={(value) => {
              setSelectedProjectId(value);
              setSelectedEnvironmentId('');
              setSelectedServiceId('');
            }}
          >
            <SelectTrigger id="railway-project">
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
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* New Project Name */}
      {selectedProjectId === 'new' && (
        <div className="space-y-2">
          <Label htmlFor="new-project-name">New Project Name</Label>
          <Input
            id="new-project-name"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder={projectName || projectId}
          />
          <p className="text-xs text-muted-foreground">
            A new project with a production environment and web service will be created when you deploy
          </p>
        </div>
      )}

      {/* Environment Selection */}
      {selectedProjectId && selectedProjectId !== 'new' && environments.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="railway-environment">Environment</Label>
          <Select value={selectedEnvironmentId} onValueChange={setSelectedEnvironmentId}>
            <SelectTrigger id="railway-environment">
              <SelectValue placeholder="Select an environment..." />
            </SelectTrigger>
            <SelectContent>
              {environments.map((env) => (
                <SelectItem key={env.id} value={env.id}>
                  {env.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Service Selection */}
      {selectedProjectId && selectedProjectId !== 'new' && selectedEnvironmentId && (
        <div className="space-y-2">
          <Label htmlFor="railway-service">Service</Label>
          <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
            <SelectTrigger id="railway-service">
              <SelectValue placeholder="Select a service or create new..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create new service
                </div>
              </SelectItem>
              {services.map((service) => (
                <SelectItem key={service.id} value={service.id}>
                  {service.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Project Info */}
      {selectedProject && selectedProjectId !== 'new' && (
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{selectedProject.name}</p>
              <p className="text-xs text-muted-foreground">
                {environments.length} environment(s), {services.length} service(s)
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => window.open(`https://railway.app/project/${selectedProject.id}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
