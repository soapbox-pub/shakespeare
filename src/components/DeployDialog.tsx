import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Rocket, ExternalLink, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDeploySettings } from '@/hooks/useDeploySettings';
import { useProjectDeploySettings } from '@/hooks/useProjectDeploySettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useFS } from '@/hooks/useFS';
import { useAppContext } from '@/hooks/useAppContext';
import { ShakespeareAdapter, NetlifyAdapter, VercelAdapter, DeployAdapter } from '@/lib/deploy';
import { Link } from 'react-router-dom';
import type { ShakespeareDeployProvider, NetlifyProvider, VercelProvider } from '@/contexts/DeploySettingsContext';
import { ShakespeareDeployForm } from '@/components/deploy/ShakespeareDeployForm';
import { NetlifyDeployForm } from '@/components/deploy/NetlifyDeployForm';
import { VercelDeployForm } from '@/components/deploy/VercelDeployForm';

interface DeployDialogProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShakespeareFormData {
  subdomain: string;
}

interface NetlifyFormData {
  siteId: string;
  siteName: string;
}

interface VercelFormData {
  projectName: string;
  teamId: string;
}

export function DeployDialog({ projectId, projectName, open, onOpenChange }: DeployDialogProps) {
  const { t } = useTranslation();
  const { settings } = useDeploySettings();
  const { settings: projectSettings, updateSettings: updateProjectSettings } = useProjectDeploySettings(projectId);
  const { user } = useCurrentUser();
  const { fs } = useFS();
  const { config } = useAppContext();

  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Provider-specific form data
  const [shakespeareForm, setShakespeareForm] = useState<ShakespeareFormData>({
    subdomain: projectId,
  });
  const [netlifyForm, setNetlifyForm] = useState<NetlifyFormData>({
    siteId: '',
    siteName: projectName || projectId,
  });
  const [vercelForm, setVercelForm] = useState<VercelFormData>({
    projectName: projectName || projectId,
    teamId: '',
  });

  // Load project settings when dialog opens
  useEffect(() => {
    if (open && projectSettings.providerId) {
      setSelectedProviderId(projectSettings.providerId);
    }
  }, [open, projectSettings]);

  const selectedProvider = settings.providers.find(p => p.id === selectedProviderId);

  const handleDeploy = async () => {
    if (!selectedProvider) return;

    setIsDeploying(true);
    setError(null);
    setDeployResult(null);

    try {
      const projectPath = `/projects/${projectId}`;

      let adapter: DeployAdapter;

      if (selectedProvider.type === 'shakespeare') {
        if (!user) {
          throw new Error('You must be logged in with Nostr to use Shakespeare Deploy');
        }

        const shakespeareProvider = selectedProvider as ShakespeareDeployProvider;
        adapter = new ShakespeareAdapter({
          fs,
          signer: user.signer,
          host: shakespeareProvider.host,
          subdomain: shakespeareForm.subdomain || undefined,
          corsProxy: shakespeareProvider.proxy ? config.corsProxy : undefined,
        });
      } else if (selectedProvider.type === 'netlify') {
        const netlifyProvider = selectedProvider as NetlifyProvider;
        if (!netlifyProvider.apiKey) {
          throw new Error('Netlify API key is required');
        }

        // If siteId is empty, we're creating a new site, so only pass siteName
        // If siteId is set, we're updating an existing site
        adapter = new NetlifyAdapter({
          fs,
          apiKey: netlifyProvider.apiKey,
          baseURL: netlifyProvider.baseURL,
          siteName: netlifyForm.siteId ? undefined : (netlifyForm.siteName || undefined),
          siteId: netlifyForm.siteId || undefined,
          corsProxy: netlifyProvider.proxy ? config.corsProxy : undefined,
        });
      } else if (selectedProvider.type === 'vercel') {
        const vercelProvider = selectedProvider as VercelProvider;
        if (!vercelProvider.apiKey) {
          throw new Error('Vercel API key is required');
        }

        adapter = new VercelAdapter({
          fs,
          apiKey: vercelProvider.apiKey,
          baseURL: vercelProvider.baseURL,
          teamId: vercelForm.teamId || undefined,
          projectName: vercelForm.projectName || undefined,
          corsProxy: vercelProvider.proxy ? config.corsProxy : undefined,
        });
      } else {
        throw new Error('Unknown provider type');
      }

      const result = await adapter.deploy({
        projectId,
        projectPath,
      });

      // Save project-specific settings
      const projectSettingsUpdate: typeof projectSettings = {
        providerId: selectedProviderId,
      };

      if (selectedProvider.type === 'netlify' && result.metadata?.siteId) {
        projectSettingsUpdate.netlify = {
          siteId: result.metadata.siteId as string,
        };
      }

      if (selectedProvider.type === 'vercel') {
        projectSettingsUpdate.vercel = {
          teamId: vercelForm.teamId || undefined,
          projectId: vercelForm.projectName || undefined,
        };
      }

      await updateProjectSettings(projectSettingsUpdate);

      setDeployResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setIsDeploying(false);
    }
  };

  const handleClose = () => {
    setSelectedProviderId('');
    setDeployResult(null);
    setError(null);
    // Reset forms
    setShakespeareForm({ subdomain: projectId });
    setNetlifyForm({ siteId: '', siteName: projectName || projectId });
    setVercelForm({ projectName: projectName || projectId, teamId: '' });
    onOpenChange(false);
  };

  const handleShakespeareSubdomainChange = useCallback((subdomain: string) => {
    setShakespeareForm({ subdomain });
  }, []);

  const handleNetlifySiteChange = useCallback((siteId: string, siteName: string) => {
    setNetlifyForm({ siteId, siteName });
  }, []);

  const handleVercelConfigChange = useCallback((projectName: string, teamId: string) => {
    setVercelForm({ projectName, teamId });
  }, []);

  const renderProviderFields = () => {
    if (!selectedProvider) return null;

    if (selectedProvider.type === 'shakespeare') {
      const shakespeareProvider = selectedProvider as ShakespeareDeployProvider;

      return (
        <ShakespeareDeployForm
          host={shakespeareProvider.host}
          projectId={projectId}
          onSubdomainChange={handleShakespeareSubdomainChange}
        />
      );
    }

    if (selectedProvider.type === 'netlify') {
      const netlifyProvider = selectedProvider as NetlifyProvider;

      return (
        <NetlifyDeployForm
          apiKey={netlifyProvider.apiKey}
          baseURL={netlifyProvider.baseURL}
          projectId={projectId}
          projectName={projectName}
          savedSiteId={projectSettings.netlify?.siteId}
          onSiteChange={handleNetlifySiteChange}
          corsProxy={netlifyProvider.proxy ? config.corsProxy : undefined}
        />
      );
    }

    if (selectedProvider.type === 'vercel') {
      return (
        <VercelDeployForm
          projectId={projectId}
          projectName={projectName}
          savedTeamId={projectSettings.vercel?.teamId}
          savedProjectName={projectSettings.vercel?.projectId}
          onConfigChange={handleVercelConfigChange}
        />
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Deploy Project
          </DialogTitle>
          <DialogDescription>
            Deploy your project to a hosting platform
          </DialogDescription>
        </DialogHeader>

        {deployResult ? (
          <div className="space-y-4">
            <Alert>
              <Rocket className="h-4 w-4" />
              <AlertDescription>
                Your project has been successfully deployed!
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Deployed URL</Label>
              <div className="flex gap-2">
                <Input
                  value={deployResult.url}
                  readOnly
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(deployResult.url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button onClick={handleClose}>
                {t('close')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {settings.providers.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No deployment providers configured.{' '}
                  <Link
                    to="/settings/deploy"
                    className="underline hover:no-underline"
                    onClick={handleClose}
                  >
                    Configure deployment settings
                  </Link>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="provider">Select Provider</Label>
                  <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                    <SelectTrigger id="provider">
                      <SelectValue placeholder="Choose a deployment provider..." />
                    </SelectTrigger>
                    <SelectContent>
                      {settings.providers.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProvider && renderProviderFields()}

                {selectedProvider?.type === 'shakespeare' && !user && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      You must be logged in with Nostr to use Shakespeare Deploy.{' '}
                      <Link
                        to="/settings/nostr"
                        className="underline hover:no-underline"
                        onClick={handleClose}
                      >
                        Go to Nostr Settings
                      </Link>
                    </AlertDescription>
                  </Alert>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    {t('cancel')}
                  </Button>
                  <Button
                    onClick={handleDeploy}
                    disabled={
                      !selectedProvider ||
                      isDeploying ||
                      (selectedProvider.type === 'shakespeare' && !user)
                    }
                  >
                    {isDeploying ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Deploying...
                      </>
                    ) : (
                      <>
                        <Rocket className="h-4 w-4 mr-2" />
                        Deploy
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
