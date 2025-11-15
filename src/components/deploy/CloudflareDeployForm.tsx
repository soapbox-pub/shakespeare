import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface CloudflareDeployFormProps {
  projectId: string;
  projectName?: string;
  savedProjectName?: string;
  savedBranch?: string;
  onConfigChange: (projectName: string, branch: string) => void;
}

export function CloudflareDeployForm({
  projectId,
  projectName: initialProjectName,
  savedProjectName,
  savedBranch,
  onConfigChange,
}: CloudflareDeployFormProps) {
  const [projectName, setProjectName] = useState(savedProjectName || initialProjectName || projectId);
  const [branch, setBranch] = useState(savedBranch || 'main');

  useEffect(() => {
    onConfigChange(projectName, branch);
  }, [projectName, branch, onConfigChange]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cloudflare-project-name">Project Name</Label>
        <Input
          id="cloudflare-project-name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder={initialProjectName || projectId}
        />
        <p className="text-xs text-muted-foreground">
          URL: <span className="font-mono">{projectName || projectId}.pages.dev</span>
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cloudflare-branch">Branch Name</Label>
        <Input
          id="cloudflare-branch"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          placeholder="main"
        />
        <p className="text-xs text-muted-foreground">
          Production branch for your Cloudflare Pages project
        </p>
      </div>
    </div>
  );
}
