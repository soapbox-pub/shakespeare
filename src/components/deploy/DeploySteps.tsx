import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Rocket, ExternalLink, AlertCircle, Settings, Cloud, Shield, Download, CheckCircle } from 'lucide-react';
import { ExternalFavicon } from '@/components/ExternalFavicon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDeploySettings } from '@/hooks/useDeploySettings';
import { useProjectDeploySettings } from '@/hooks/useProjectDeploySettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useFS } from '@/hooks/useFS';
import { useFSPaths } from '@/hooks/useFSPaths';
import { useAppContext } from '@/hooks/useAppContext';
import { useNostr } from '@nostrify/react';
import { Link } from 'react-router-dom';
import type { DeployProvider } from '@/contexts/DeploySettingsContext';
import type { APKBuildType } from '@/lib/deploy/types';
import { ShakespeareDeployForm } from '@/components/deploy/ShakespeareDeployForm';
import { NetlifyDeployForm } from '@/components/deploy/NetlifyDeployForm';
import { VercelDeployForm } from '@/components/deploy/VercelDeployForm';
import { NsiteDeployForm } from '@/components/deploy/NsiteDeployForm';
import { CloudflareDeployForm } from '@/components/deploy/CloudflareDeployForm';
import { DenoDeployForm } from '@/components/deploy/DenoDeployForm';
import { APKBuilderDeployForm } from '@/components/deploy/APKBuilderDeployForm';
import { APKSigner } from '@/components/deploy/APKSigner';
import { cn } from '@/lib/utils';
import { DeployAdapter } from '@/lib/deploy/types';
import { ShakespeareAdapter } from '@/lib/deploy/ShakespeareAdapter';
import { NsiteAdapter } from '@/lib/deploy/NsiteAdapter';
import { NetlifyAdapter } from '@/lib/deploy/NetlifyAdapter';
import { VercelAdapter } from '@/lib/deploy/VercelAdapter';
import { CloudflareAdapter } from '@/lib/deploy/CloudflareAdapter';
import { DenoDeployAdapter } from '@/lib/deploy/DenoDeployAdapter';
import { APKBuilderAdapter } from '@/lib/deploy/APKBuilderAdapter';

/**
 * Helper function to get provider URL for favicon
 */
function getProviderUrl(provider: DeployProvider): string | null {
  switch (provider.type) {
    case 'shakespeare':
      if (provider.host) {
        return `https://${provider.host}`;
      }
      return 'https://shakespeare.diy';

    case 'netlify':
      if (provider.baseURL) {
        return provider.baseURL;
      }
      return 'https://netlify.com';

    case 'vercel':
      if (provider.baseURL) {
        return provider.baseURL;
      }
      return 'https://vercel.com';

    case 'cloudflare':
      if (provider.baseURL) {
        return provider.baseURL;
      }
      return 'https://cloudflare.com';

    case 'deno':
      if (provider.baseURL) {
        return provider.baseURL;
      }
      return 'https://deno.com';

    case 'nsite':
      return null;

    case 'apkbuilder':
      // Use Android's favicon
      return 'https://android.com';

    default:
      return null;
  }
}

/**
 * Render provider icon using favicon or fallback
 */
function renderProviderIcon(provider: DeployProvider, size = 14) {
  const url = getProviderUrl(provider);

  if (url) {
    return (
      <ExternalFavicon
        url={url}
        size={size}
        fallback={<Rocket size={size} />}
      />
    );
  }

  return <Rocket size={size} />;
}

interface DeployStepsProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

interface ShakespeareFormData {
  subdomain: string;
}

interface NsiteFormData {
  nsec: string;
}

interface NetlifyFormData {
  siteId: string;
  siteName: string;
}

interface VercelFormData {
  projectName: string;
  teamId: string;
}

interface CloudflareFormData {
  projectName: string;
}

interface DenoDeployFormData {
  projectName: string;
}

interface APKBuilderFormData {
  appName: string;
  packageId: string;
  buildType: APKBuildType;
}

export function DeploySteps({ projectId, projectName, onClose }: DeployStepsProps) {
  const { t } = useTranslation();
  const { settings } = useDeploySettings();
  const { settings: projectSettings, updateSettings: updateProjectSettings } = useProjectDeploySettings(projectId);
  const { user } = useCurrentUser();
  const { fs } = useFS();
  const { projectsPath } = useFSPaths();
  const { config } = useAppContext();
  const { nostr } = useNostr();

  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ url: string } | null>(null);
  const [signedApkBlob, setSignedApkBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isShakespeareFormValid, setIsShakespeareFormValid] = useState(true);

  // Provider-specific form data
  const [shakespeareForm, setShakespeareForm] = useState<ShakespeareFormData>({
    subdomain: projectId,
  });
  const [nsiteForm, setNsiteForm] = useState<NsiteFormData>({
    nsec: '',
  });
  const [netlifyForm, setNetlifyForm] = useState<NetlifyFormData>({
    siteId: '',
    siteName: '',
  });
  const [vercelForm, setVercelForm] = useState<VercelFormData>({
    projectName: projectName || projectId,
    teamId: '',
  });
  const [cloudflareForm, setCloudflareForm] = useState<CloudflareFormData>({
    projectName: projectName || projectId,
  });
  const [denoDeployForm, setDenoDeployForm] = useState<DenoDeployFormData>({
    projectName: projectName || projectId,
  });
  const [apkBuilderForm, setApkBuilderForm] = useState<APKBuilderFormData>({
    appName: projectName || projectId,
    packageId: '',
    buildType: 'debug',
  });

  // Load project settings when component mounts
  useEffect(() => {
    // First, try to use the currentProvider from project settings
    if (projectSettings.currentProvider && settings.providers.some(p => p.id === projectSettings.currentProvider)) {
      setSelectedProviderId(projectSettings.currentProvider);
    } else {
      // Otherwise, find the first configured provider in project settings
      const providerIds = Object.keys(projectSettings.providers);
      if (providerIds.length > 0) {
        setSelectedProviderId(providerIds[0]);
      }
    }
  }, [projectSettings, settings.providers]);

  const selectedProvider = settings.providers.find(p => p.id === selectedProviderId);

  const handleDeploy = async () => {
    if (!selectedProvider) return;

    setIsDeploying(true);
    setError(null);
    setDeployResult(null);

    try {
      const projectPath = `${projectsPath}/${projectId}`;

      let adapter: DeployAdapter;

      if (selectedProvider.type === 'shakespeare') {
        if (!user) {
          throw new Error('You must be logged in with Nostr to use Shakespeare Deploy');
        }

        const shakespeareProvider = selectedProvider;
        adapter = new ShakespeareAdapter({
          fs,
          signer: user.signer,
          host: shakespeareProvider.host,
          subdomain: shakespeareForm.subdomain || undefined,
          corsProxy: shakespeareProvider.proxy ? config.corsProxy : undefined,
        });
      } else if (selectedProvider.type === 'nsite') {
        const nsiteProvider = selectedProvider;

        if (!nsiteForm.nsec) {
          throw new Error('Site private key (nsec) is required');
        }

        adapter = new NsiteAdapter({
          fs,
          nostr,
          nsec: nsiteForm.nsec,
          gateway: nsiteProvider.gateway,
          relayUrls: nsiteProvider.relayUrls,
          blossomServers: nsiteProvider.blossomServers,
        });
      } else if (selectedProvider.type === 'netlify') {
        const netlifyProvider = selectedProvider;
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
        const vercelProvider = selectedProvider;
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
      } else if (selectedProvider.type === 'cloudflare') {
        const cloudflareProvider = selectedProvider;
        if (!cloudflareProvider.apiKey) {
          throw new Error('Cloudflare API key is required');
        }
        if (!cloudflareProvider.accountId) {
          throw new Error('Cloudflare account ID is required');
        }

        adapter = new CloudflareAdapter({
          fs,
          apiKey: cloudflareProvider.apiKey,
          accountId: cloudflareProvider.accountId,
          baseURL: cloudflareProvider.baseURL,
          baseDomain: cloudflareProvider.baseDomain,
          projectName: cloudflareForm.projectName || undefined,
          corsProxy: cloudflareProvider.proxy ? config.corsProxy : undefined,
        });
      } else if (selectedProvider.type === 'deno') {
        const denoProvider = selectedProvider;
        if (!denoProvider.apiKey) {
          throw new Error('Deno Deploy access token is required');
        }
        if (!denoProvider.organizationId) {
          throw new Error('Deno Deploy organization ID is required');
        }

        adapter = new DenoDeployAdapter({
          fs,
          apiKey: denoProvider.apiKey,
          organizationId: denoProvider.organizationId,
          baseDomain: denoProvider.baseDomain,
          baseURL: denoProvider.baseURL,
          projectName: denoDeployForm.projectName || undefined,
          corsProxy: denoProvider.proxy ? config.corsProxy : undefined,
        });
      } else if (selectedProvider.type === 'apkbuilder') {
        const apkBuilderProvider = selectedProvider;
        if (!apkBuilderProvider.buildServerUrl) {
          throw new Error('APK Builder server URL is required');
        }
        if (!apkBuilderProvider.apiKey) {
          throw new Error('APK Builder API key is required');
        }
        if (!apkBuilderForm.appName) {
          throw new Error('App name is required');
        }
        if (!apkBuilderForm.packageId) {
          throw new Error('Package ID is required');
        }

        adapter = new APKBuilderAdapter({
          fs,
          buildServerUrl: apkBuilderProvider.buildServerUrl,
          apiKey: apkBuilderProvider.apiKey,
          appName: apkBuilderForm.appName,
          packageId: apkBuilderForm.packageId,
          buildType: apkBuilderForm.buildType,
          corsProxy: apkBuilderProvider.proxy ? config.corsProxy : undefined,
        });
      } else {
        throw new Error('Unknown provider type');
      }

      const result = await adapter.deploy({
        projectId,
        projectPath,
      });

      // Save project-specific settings (updateSettings now automatically sets currentProvider)
      if (selectedProvider.type === 'shakespeare') {
        await updateProjectSettings(selectedProviderId, {
          type: 'shakespeare',
          url: result.url,
          data: {
            subdomain: shakespeareForm.subdomain || undefined,
          },
        });
      } else if (selectedProvider.type === 'nsite') {
        await updateProjectSettings(selectedProviderId, {
          type: 'nsite',
          url: result.url,
          data: {
            nsec: nsiteForm.nsec,
          },
        });
      } else if (selectedProvider.type === 'netlify') {
        await updateProjectSettings(selectedProviderId, {
          type: 'netlify',
          url: result.url,
          data: {
            siteId: result.metadata?.siteId as string | undefined,
          },
        });
      } else if (selectedProvider.type === 'vercel') {
        await updateProjectSettings(selectedProviderId, {
          type: 'vercel',
          url: result.url,
          data: {
            teamId: vercelForm.teamId || undefined,
            projectId: vercelForm.projectName || undefined,
          },
        });
      } else if (selectedProvider.type === 'cloudflare') {
        await updateProjectSettings(selectedProviderId, {
          type: 'cloudflare',
          url: result.url,
          data: {
            projectName: cloudflareForm.projectName || undefined,
          },
        });
      } else if (selectedProvider.type === 'deno') {
        await updateProjectSettings(selectedProviderId, {
          type: 'deno',
          url: result.url,
          data: {
            projectName: denoDeployForm.projectName || undefined,
          },
        });
      } else if (selectedProvider.type === 'apkbuilder') {
        await updateProjectSettings(selectedProviderId, {
          type: 'apkbuilder',
          url: result.url,
          data: {
            appName: apkBuilderForm.appName,
            packageId: apkBuilderForm.packageId,
            buildType: apkBuilderForm.buildType,
          },
        });
      }

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
    setSignedApkBlob(null);
    setError(null);
    // Reset forms
    setShakespeareForm({ subdomain: projectId });
    setNsiteForm({ nsec: '' });
    setNetlifyForm({ siteId: '', siteName: '' });
    setVercelForm({ projectName: projectName || projectId, teamId: '' });
    setCloudflareForm({ projectName: projectName || projectId });
    setDenoDeployForm({ projectName: projectName || projectId });
    setApkBuilderForm({ appName: projectName || projectId, packageId: '', buildType: 'debug' });
    onClose();
  };

  const handleSigningComplete = useCallback((blob: Blob) => {
    setSignedApkBlob(blob);
  }, []);

  const handleDownloadSignedApk = useCallback(() => {
    if (!signedApkBlob) return;

    const url = URL.createObjectURL(signedApkBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${apkBuilderForm.appName.replace(/[^a-zA-Z0-9]/g, '_')}_signed.apk`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [signedApkBlob, apkBuilderForm.appName]);

  const handleShakespeareSubdomainChange = useCallback((subdomain: string) => {
    setShakespeareForm({ subdomain });
  }, []);

  const handleShakespeareValidationChange = useCallback((isValid: boolean) => {
    setIsShakespeareFormValid(isValid);
  }, []);

  const handleNsiteNsecChange = useCallback((nsec: string) => {
    setNsiteForm({ nsec });
  }, []);

  const handleNetlifySiteChange = useCallback((siteId: string, siteName: string) => {
    setNetlifyForm({ siteId, siteName });
  }, []);

  const handleVercelConfigChange = useCallback((projectName: string, teamId: string) => {
    setVercelForm({ projectName, teamId });
  }, []);

  const handleCloudflareProjectChange = useCallback((projectName: string) => {
    setCloudflareForm({ projectName });
  }, []);

  const handleDenoDeployProjectChange = useCallback((projectName: string) => {
    setDenoDeployForm({ projectName });
  }, []);

  const handleApkBuilderConfigChange = useCallback((appName: string, packageId: string, buildType: APKBuildType) => {
    setApkBuilderForm({ appName, packageId, buildType });
  }, []);

  const renderProviderFields = () => {
    if (!selectedProvider) return null;

    if (selectedProvider.type === 'shakespeare') {
      const shakespeareProvider = selectedProvider;
      const savedConfig = projectSettings.providers[selectedProviderId];
      const savedSubdomain = savedConfig?.type === 'shakespeare' ? savedConfig.data.subdomain : undefined;

      return (
        <ShakespeareDeployForm
          host={shakespeareProvider.host}
          projectId={projectId}
          savedSubdomain={savedSubdomain}
          onSubdomainChange={handleShakespeareSubdomainChange}
          onValidationChange={handleShakespeareValidationChange}
        />
      );
    }

    if (selectedProvider.type === 'nsite') {
      const savedConfig = projectSettings.providers[selectedProviderId];
      const savedNsec = savedConfig?.type === 'nsite' ? savedConfig.data.nsec : undefined;

      return (
        <NsiteDeployForm
          gateway={selectedProvider.gateway}
          savedNsec={savedNsec}
          onNsecChange={handleNsiteNsecChange}
        />
      );
    }

    if (selectedProvider.type === 'netlify') {
      const savedConfig = projectSettings.providers[selectedProviderId];
      const savedSiteId = savedConfig?.type === 'netlify' ? savedConfig.data.siteId : undefined;

      return (
        <NetlifyDeployForm
          apiKey={selectedProvider.apiKey}
          baseURL={selectedProvider.baseURL}
          projectId={projectId}
          projectName={projectName}
          savedSiteId={savedSiteId}
          onSiteChange={handleNetlifySiteChange}
          corsProxy={selectedProvider.proxy ? config.corsProxy : undefined}
        />
      );
    }

    if (selectedProvider.type === 'vercel') {
      const savedConfig = projectSettings.providers[selectedProviderId];
      const savedTeamId = savedConfig?.type === 'vercel' ? savedConfig.data.teamId : undefined;
      const savedProjectName = savedConfig?.type === 'vercel' ? savedConfig.data.projectId : undefined;

      return (
        <VercelDeployForm
          projectId={projectId}
          projectName={projectName}
          savedTeamId={savedTeamId}
          savedProjectName={savedProjectName}
          onConfigChange={handleVercelConfigChange}
        />
      );
    }

    if (selectedProvider.type === 'cloudflare') {
      const cloudflareProvider = selectedProvider;
      const savedConfig = projectSettings.providers[selectedProviderId];
      const savedProjectName = savedConfig?.type === 'cloudflare' ? savedConfig.data.projectName : undefined;

      return (
        <CloudflareDeployForm
          apiKey={cloudflareProvider.apiKey}
          accountId={cloudflareProvider.accountId}
          baseURL={cloudflareProvider.baseURL}
          baseDomain={cloudflareProvider.baseDomain}
          projectId={projectId}
          projectName={projectName}
          savedProjectName={savedProjectName}
          onProjectChange={handleCloudflareProjectChange}
          corsProxy={cloudflareProvider.proxy ? config.corsProxy : undefined}
        />
      );
    }

    if (selectedProvider.type === 'deno') {
      const denoProvider = selectedProvider;
      const savedConfig = projectSettings.providers[selectedProviderId];
      const savedProjectName = savedConfig?.type === 'deno' ? savedConfig.data.projectName : undefined;

      return (
        <DenoDeployForm
          apiKey={denoProvider.apiKey}
          organizationId={denoProvider.organizationId}
          baseURL={denoProvider.baseURL}
          baseDomain={denoProvider.baseDomain}
          projectId={projectId}
          projectName={projectName}
          savedProjectName={savedProjectName}
          onProjectChange={handleDenoDeployProjectChange}
          corsProxy={denoProvider.proxy ? config.corsProxy : undefined}
        />
      );
    }

    if (selectedProvider.type === 'apkbuilder') {
      const apkBuilderProvider = selectedProvider;
      const savedConfig = projectSettings.providers[selectedProviderId];
      const savedAppName = savedConfig?.type === 'apkbuilder' ? savedConfig.data.appName : undefined;
      const savedPackageId = savedConfig?.type === 'apkbuilder' ? savedConfig.data.packageId : undefined;
      const savedBuildType = savedConfig?.type === 'apkbuilder' ? savedConfig.data.buildType : undefined;

      return (
        <APKBuilderDeployForm
          buildServerUrl={apkBuilderProvider.buildServerUrl}
          apiKey={apkBuilderProvider.apiKey}
          projectId={projectId}
          projectName={projectName}
          savedAppName={savedAppName}
          savedPackageId={savedPackageId}
          savedBuildType={savedBuildType}
          onConfigChange={handleApkBuilderConfigChange}
          corsProxy={apkBuilderProvider.proxy ? config.corsProxy : undefined}
        />
      );
    }

    return null;
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-1">Deploy your project</h3>
        <p className="text-sm text-muted-foreground">
          Choose a provider to deploy your project
        </p>
      </div>

      {deployResult ? (
        <div className="space-y-4">
          {/* Release APK signing flow */}
          {selectedProvider?.type === 'apkbuilder' && apkBuilderForm.buildType === 'release' ? (
            <>
              {/* Step indicator */}
              <div className="flex items-center gap-2 text-sm">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                  <CheckCircle className="h-3 w-3" />
                </div>
                <span className="text-muted-foreground line-through">Build</span>
                <div className="flex-1 h-px bg-border" />
                <div className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium",
                  signedApkBlob
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary text-primary-foreground"
                )}>
                  {signedApkBlob ? <CheckCircle className="h-3 w-3" /> : '2'}
                </div>
                <span className={signedApkBlob ? "text-muted-foreground line-through" : "font-medium"}>Sign</span>
                <div className="flex-1 h-px bg-border" />
                <div className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium",
                  signedApkBlob
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}>
                  3
                </div>
                <span className={signedApkBlob ? "font-medium" : "text-muted-foreground"}>Download</span>
              </div>

              {signedApkBlob ? (
                /* Signing complete - show download */
                <>
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      APK signed successfully! Download your release-ready APK.
                    </AlertDescription>
                  </Alert>

                  <div className="rounded-lg border p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{apkBuilderForm.appName}_signed.apk</p>
                        <p className="text-xs text-muted-foreground">
                          {(signedApkBlob.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button onClick={handleDownloadSignedApk}>
                        <Download className="h-4 w-4 mr-2" />
                        Download APK
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button onClick={handleClose}>
                      {t('close')}
                    </Button>
                  </div>
                </>
              ) : (
                /* Show signing UI */
                <>
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      Release APK built! Sign it with your keystore to install on devices.
                    </AlertDescription>
                  </Alert>

                  <APKSigner
                    unsignedApkUrl={deployResult.url}
                    appName={apkBuilderForm.appName}
                    onComplete={handleSigningComplete}
                    onCancel={handleClose}
                  />
                </>
              )}
            </>
          ) : (
            /* Standard success UI for debug APK and other providers */
            <>
              <Alert>
                <Rocket className="h-4 w-4" />
                <AlertDescription>
                  {selectedProvider?.type === 'apkbuilder'
                    ? 'Your project has been successfully built!'
                    : 'Your project has been successfully deployed!'}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>{selectedProvider?.type === 'apkbuilder' ? 'Download URL' : 'Deployed URL'}</Label>
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
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {settings.providers.length === 0 ? (
            <div className="py-8 px-4">
              <div className="max-w-md mx-auto space-y-6 text-center">
                {/* Icon */}
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl"></div>
                    <div className="relative bg-gradient-to-br from-primary/20 to-primary/5 p-6 rounded-2xl border border-primary/20">
                      <Cloud className="h-12 w-12 text-primary" />
                    </div>
                  </div>
                </div>

                {/* Heading */}
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">Choose Your Deployment Platform</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Deploy your Shakespeare projects to any hosting provider. Configure your preferred platform to get started.
                  </p>
                </div>

                {/* CTA */}
                <div className="pt-2">
                  <Button
                    asChild
                    size="lg"
                    className="w-full"
                    onClick={handleClose}
                  >
                    <Link to="/settings/deploy">
                      <Settings className="h-4 w-4 mr-2" />
                      Configure Deployment Provider
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Select Provider</Label>
                <div className="flex flex-wrap gap-2">
                  {settings.providers.map((provider) => (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => setSelectedProviderId(provider.id)}
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                        "border-2 hover:scale-105 active:scale-95",
                        selectedProviderId === provider.id
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-background text-foreground border-border hover:border-primary/50"
                      )}
                    >
                      {renderProviderIcon(provider, 14)}
                      <span>{provider.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedProvider && selectedProviderId && (() => {
                const savedConfig = projectSettings.providers[selectedProviderId];
                const url = savedConfig?.url;

                if (url) {
                  return (
                    <div className="space-y-2">
                      <Label>Last Deployment</Label>
                      <div className="flex gap-2">
                        <Input
                          value={url}
                          readOnly
                          className="flex-1 text-muted-foreground"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(url, '_blank')}
                          title="Visit last deployment"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

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

              {selectedProvider && (
                <Button
                  onClick={handleDeploy}
                  disabled={
                    isDeploying ||
                    (selectedProvider.type === 'shakespeare' && !user) ||
                    (selectedProvider.type === 'shakespeare' && !isShakespeareFormValid) ||
                    (selectedProvider.type === 'nsite' && !nsiteForm.nsec) ||
                    (selectedProvider.type === 'netlify' && !netlifyForm.siteId && !netlifyForm.siteName) ||
                    (selectedProvider.type === 'cloudflare' && !cloudflareForm.projectName) ||
                    (selectedProvider.type === 'deno' && !denoDeployForm.projectName) ||
                    (selectedProvider.type === 'apkbuilder' && (!apkBuilderForm.appName || !apkBuilderForm.packageId))
                  }
                  className="w-full"
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
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
