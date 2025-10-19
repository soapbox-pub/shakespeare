import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface VercelDeployFormProps {
  projectId: string;
  projectName?: string;
  savedTeamId?: string;
  savedProjectName?: string;
  onConfigChange: (projectName: string, teamId: string) => void;
}

export function VercelDeployForm({
  projectId,
  projectName: initialProjectName,
  savedTeamId,
  savedProjectName,
  onConfigChange,
}: VercelDeployFormProps) {
  const [projectName, setProjectName] = useState(savedProjectName || initialProjectName || projectId);
  const [teamId, setTeamId] = useState(savedTeamId || '');

  useEffect(() => {
    onConfigChange(projectName, teamId);
  }, [projectName, teamId, onConfigChange]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="vercel-project-name">Project Name</Label>
        <Input
          id="vercel-project-name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder={initialProjectName || projectId}
        />
        <p className="text-xs text-muted-foreground">
          URL: <span className="font-mono">{projectName || projectId}.vercel.app</span>
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="vercel-team-id">Team ID (optional)</Label>
        <Input
          id="vercel-team-id"
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          placeholder="Leave empty for personal account"
        />
        <p className="text-xs text-muted-foreground">
          Deploy to a team account instead of your personal account
        </p>
      </div>
    </div>
  );
}
