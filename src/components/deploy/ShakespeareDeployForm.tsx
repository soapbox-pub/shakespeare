import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertCircle } from 'lucide-react';

interface ShakespeareDeployFormProps {
  host?: string;
  projectId: string;
  savedSubdomain?: string;
  onSubdomainChange: (subdomain: string) => void;
  onValidationChange?: (isValid: boolean) => void;
}

export function ShakespeareDeployForm({
  host = 'shakespeare.wtf',
  projectId,
  savedSubdomain,
  onSubdomainChange,
  onValidationChange,
}: ShakespeareDeployFormProps) {
  const [subdomain, setSubdomain] = useState(savedSubdomain || projectId);

  // Update subdomain when savedSubdomain changes (e.g., when switching providers)
  useEffect(() => {
    setSubdomain(savedSubdomain || projectId);
  }, [savedSubdomain, projectId]);

  // Validate subdomain: no periods allowed (only single-level subdomains)
  const hasPeriod = subdomain.includes('.');
  const isValid = subdomain.trim() !== '' && !hasPeriod;

  useEffect(() => {
    onSubdomainChange(subdomain);
  }, [subdomain, onSubdomainChange]);

  useEffect(() => {
    onValidationChange?.(isValid);
  }, [isValid, onValidationChange]);

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
          className={hasPeriod ? 'border-destructive' : ''}
        />
        {hasPeriod && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>Subdomain cannot contain periods. Use hyphens instead (e.g., "nostr-radar").</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Will deploy to: <span className="font-mono">{fullDomain}</span>
        </p>
      </div>
    </div>
  );
}
