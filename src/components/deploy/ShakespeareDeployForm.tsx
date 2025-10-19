import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface ShakespeareDeployFormProps {
  host?: string;
  projectId: string;
  onSubdomainChange: (subdomain: string) => void;
}

export function ShakespeareDeployForm({
  host = 'shakespeare.wtf',
  projectId,
  onSubdomainChange,
}: ShakespeareDeployFormProps) {
  const [subdomain, setSubdomain] = useState(projectId);

  useEffect(() => {
    onSubdomainChange(subdomain);
  }, [subdomain, onSubdomainChange]);

  const fullDomain = subdomain ? `${subdomain}.${host}` : `${projectId}.${host}`;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="shakespeare-subdomain">Subdomain</Label>
        <Input
          id="shakespeare-subdomain"
          value={subdomain}
          onChange={(e) => setSubdomain(e.target.value)}
          placeholder={projectId}
        />
        <p className="text-xs text-muted-foreground">
          Will deploy to: <span className="font-mono">{fullDomain}</span>
        </p>
      </div>
    </div>
  );
}
