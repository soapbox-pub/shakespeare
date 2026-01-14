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

interface NetlifySite {
  id: string;
  site_id: string;
  name: string;
  url: string;
  admin_url: string;
}

interface NetlifyDeployFormProps {
  apiKey: string;
  baseURL?: string;
  projectId: string;
  projectName?: string;
  savedSiteId?: string;
  onSiteChange: (siteId: string, siteName: string) => void;
  corsProxy?: string;
}

export function NetlifyDeployForm({
  apiKey,
  baseURL = 'https://api.netlify.com/api/v1',
  projectId,
  projectName,
  savedSiteId,
  onSiteChange,
  corsProxy,
}: NetlifyDeployFormProps) {
  const [sites, setSites] = useState<NetlifySite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [newSiteName, setNewSiteName] = useState(projectName || projectId);

  const fetchSites = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const url = `${baseURL}/sites`;
      const targetUrl = corsProxy ? proxyUrl({ template: corsProxy, url }) : url;

      const response = await fetch(targetUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch sites: ${response.status} ${response.statusText}`);
      }

      const data: NetlifySite[] = await response.json();
      setSites(data);

      // If there's a saved site ID and it exists in the list, select it
      // Otherwise leave it empty (showing placeholder)
      if (savedSiteId && data.some(s => s.id === savedSiteId)) {
        setSelectedSiteId(savedSiteId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sites');
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, baseURL, savedSiteId, corsProxy]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  // Update newSiteName when switching to "new" if it's empty
  useEffect(() => {
    if (selectedSiteId === 'new' && !newSiteName) {
      setNewSiteName(projectName || projectId);
    }
  }, [selectedSiteId, newSiteName, projectName, projectId]);

  useEffect(() => {
    if (selectedSiteId === '') {
      // No selection yet - don't call onSiteChange
      return;
    } else if (selectedSiteId === 'new') {
      onSiteChange('', newSiteName);
    } else {
      const site = sites.find(s => s.id === selectedSiteId);
      if (site) {
        onSiteChange(site.id, site.name);
      }
    }
  }, [selectedSiteId, newSiteName, sites, onSiteChange]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Site</Label>
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  const selectedSite = sites.find(s => s.id === selectedSiteId);

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="netlify-site">Select Site</Label>
        <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
          <SelectTrigger id="netlify-site">
            <SelectValue placeholder="Select a site or create new..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create new site
              </div>
            </SelectItem>
            {sites.map((site) => (
              <SelectItem key={site.id} value={site.id}>
                {site.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedSiteId === 'new' ? (
        <div className="space-y-2">
          <Label htmlFor="new-site-name">New Site Name</Label>
          <Input
            id="new-site-name"
            value={newSiteName}
            onChange={(e) => setNewSiteName(e.target.value)}
            placeholder={projectName || projectId}
          />
          <p className="text-xs text-muted-foreground">
            Domain: <span className="font-mono">{newSiteName || projectId}.netlify.app</span>
          </p>
          <p className="text-xs text-muted-foreground">
            A new site will be created when you deploy
          </p>
        </div>
      ) : selectedSite ? (
        <div className="space-y-2">
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{selectedSite.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{selectedSite.url}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => window.open(selectedSite.admin_url, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Deployment will update this existing site
          </p>
        </div>
      ) : null}
    </div>
  );
}
