import { useState, useEffect } from 'react';
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
import { ShakespeareAdapter, NetlifyAdapter, VercelAdapter, DeployAdapter } from '@/lib/deploy';
import type { DeployProvider } from '@/contexts/DeploySettingsContext';
import { Link } from 'react-router-dom';

interface DeployDialogProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeployDialog({ projectId, projectName, open, onOpenChange }: DeployDialogProps) {
  const { t } = useTranslation();
  const { settings } = useDeploySettings();
  const { settings: projectSettings, updateSettings: updateProjectSettings } = useProjectDeploySettings(projectId);
  const { user } = useCurrentUser();
  const { fs } = useFS();

  const [selectedProviderName, setSelectedProviderName] = useState<string>('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load project settings when dialog opens
  useEffect(() => {
    if (open && projectSettings.providerId) {
      setSelectedProviderName(projectSettings.providerId);
    }
  }, [open, projectSettings]);

  const selectedProvider = settings.providers.find(p => p.name === selectedProviderName);

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
        adapter = new ShakespeareAdapter({
          signer: user.signer,
          host: selectedProvider.host,
        });
      } else if (selectedProvider.type === 'netlify') {
        if (!selectedProvider.apiKey) {
          throw new Error('Netlify API key is required');
        }

        adapter = new NetlifyAdapter({
          apiKey: selectedProvider.apiKey,
          baseURL: selectedProvider.baseURL,
        });
      } else if (selectedProvider.type === 'vercel') {
        if (!selectedProvider.apiKey) {
          throw new Error('Vercel API key is required');
        }

        adapter = new VercelAdapter({
          apiKey: selectedProvider.apiKey,
          baseURL: selectedProvider.baseURL,
        });
      } else {
        throw new Error('Unknown provider type');
      }

      const result = await adapter.deploy({
        projectId,
        projectName,
        fs,
        projectPath,
      });

      // Save project-specific settings
      await updateProjectSettings({
        providerId: selectedProviderName,
      });

      setDeployResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setIsDeploying(false);
    }
  };

  const handleClose = () => {
    setSelectedProviderName('');
    setDeployResult(null);
    setError(null);
    onOpenChange(false);
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
                  <Select value={selectedProviderName} onValueChange={setSelectedProviderName}>
                    <SelectTrigger id="provider">
                      <SelectValue placeholder="Choose a deployment provider..." />
                    </SelectTrigger>
                    <SelectContent>
                      {settings.providers.map((provider) => (
                        <SelectItem key={provider.name} value={provider.name}>
                          {provider.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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
