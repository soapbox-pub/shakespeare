import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Rocket, ExternalLink, AlertCircle, Settings, Cloud } from 'lucide-react';
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
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useGit } from '@/hooks/useGit';
import { NostrURI } from '@/lib/NostrURI';
import { Link } from 'react-router-dom';
import type { DeployProvider, NpanelProvider } from '@/contexts/DeploySettingsContext';
import { NpanelMigrationDialog } from '@/components/deploy/NpanelMigrationDialog';
import type { PresetDeployProvider } from '@/lib/deploy/types';
import { PRESET_DEPLOY_PROVIDERS } from '@/lib/deployProviderPresets';
import { NpanelDeployForm } from '@/components/deploy/NpanelDeployForm';
import { NetlifyDeployForm } from '@/components/deploy/NetlifyDeployForm';
import { VercelDeployForm } from '@/components/deploy/VercelDeployForm';
import { NsiteDeployForm } from '@/components/deploy/NsiteDeployForm';
import { CloudflareDeployForm } from '@/components/deploy/CloudflareDeployForm';
import { DenoDeployForm } from '@/components/deploy/DenoDeployForm';
import { RailwayDeployForm } from '@/components/deploy/RailwayDeployForm';
import { cn } from '@/lib/utils';
import type { DeployAdapter, DeployProgress } from '@/lib/deploy/types';
import { Progress } from '@/components/ui/progress';
import { NpanelAdapter } from '@/lib/deploy/NpanelAdapter';
import { NsiteAdapter } from '@/lib/deploy/NsiteAdapter';
import { NetlifyAdapter } from '@/lib/deploy/NetlifyAdapter';
import { VercelAdapter } from '@/lib/deploy/VercelAdapter';
import { CloudflareAdapter } from '@/lib/deploy/CloudflareAdapter';
import { DenoDeployAdapter } from '@/lib/deploy/DenoDeployAdapter';
import { RailwayAdapter } from '@/lib/deploy/RailwayAdapter';
import { readNsiteVfsConfig, writeNsiteVfsConfig } from '@/lib/nsiteConfig';
import type { NsiteVfsConfig } from '@/lib/nsiteConfig';
import { projectNameToDTag } from '@/lib/utils/nsite';

/**
 * Normalize a URL string to ensure it has a protocol
 */
function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return `https://${url}`;
}

async function resolveNsiteSourceUrl(remoteUrl: string | null): Promise<string | undefined> {
  if (!remoteUrl) {
    return undefined;
  }

  if (/^https?:\/\//i.test(remoteUrl)) {
    return remoteUrl;
  }

  if (remoteUrl.startsWith('nostr://')) {
    const nostrURI = await NostrURI.parse(remoteUrl);
    return nostrURI.toString();
  }

  return undefined;
}

/**
 * Render provider icon using favicon or fallback
 */
function renderProviderIcon(provider: DeployProvider, preset: PresetDeployProvider | undefined, size = 14) {
  // Use baseURL from configured provider, falling back to preset baseURL
  const baseURL = ('baseURL' in provider && provider.baseURL) || preset?.baseURL;

  // A gateway is recognised by the domain it serves, not by its API origin —
  // that is the name the user picked it for and the one with an icon.
  const gatewayUrl = provider.type === 'npanel' ? normalizeUrl(provider.domain) : undefined;

  const url = gatewayUrl || baseURL;

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

interface NpanelFormData {
  subdomain: string;
  siteTitle: string;
  siteDescription: string;
}

interface NsiteFormData {
  siteTitle: string;
  siteDescription: string;
  dTag: string;
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

interface RailwayFormData {
  workspaceId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  projectName?: string;
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
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { git } = useGit();

  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [progress, setProgress] = useState<DeployProgress | null>(null);
  const [deployResult, setDeployResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isNpanelFormValid, setIsNpanelFormValid] = useState(true);
  /**
   * The gateway whose held names are being looked at, if any.
   *
   * Owned here rather than by the name field, because what someone recognising
   * one of their names wants is usually all of them, and because the dialog
   * that hands them back outlives the field that prompted it.
   */
  const [migratingProvider, setMigratingProvider] = useState<NpanelProvider | null>(null);

  /**
   * Whether the deploy failed because the gateway is holding the name for this
   * user, which is a refusal with something to do about it.
   *
   * Read off the sentence npanel sent rather than a status code, since the 409
   * it arrives as also covers a name somebody else holds and a name that is
   * simply configured already.
   */
  const heldName = error !== null && /being held for you/i.test(error);

  // .nsite/config.json state — loaded once on mount, used to skip config form on re-deploy
  const [nsiteVfsConfig, setNsiteVfsConfig] = useState<NsiteVfsConfig | null>(null);
  const [nsiteVfsConfigLoading, setNsiteVfsConfigLoading] = useState(true);
  // When a .nsite/config.json already exists, hide the full form and show a summary instead.
  // The user can click "Edit" to expand it.
  const [nsiteShowFullForm, setNsiteShowFullForm] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setNsiteVfsConfigLoading(false);
      return;
    }
    const projectPath = `${projectsPath}/${projectId}`;
    readNsiteVfsConfig(fs, projectPath)
      .then((cfg) => {
        setNsiteVfsConfig(cfg);
        // If a config already exists, seed the form from it and stay in summary mode.
        // If not, show the full form so the user can configure for the first time.
        if (cfg) {
          setNsiteForm({
            siteTitle: cfg.title ?? '',
            siteDescription: cfg.description ?? '',
            dTag: (cfg.id != null && cfg.id !== '') ? cfg.id : '',
          });
          setNsiteShowFullForm(false);
        } else {
          setNsiteShowFullForm(true);
        }
      })
      .finally(() => setNsiteVfsConfigLoading(false));
  }, [fs, projectsPath, projectId]);

  // Provider-specific form data
  const [npanelForm, setNpanelForm] = useState<NpanelFormData>({
    subdomain: projectId,
    siteTitle: projectName || projectId,
    siteDescription: '',
  });
  const [nsiteForm, setNsiteForm] = useState<NsiteFormData>({
    siteTitle: '',
    siteDescription: '',
    dTag: '',
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
  const [railwayForm, setRailwayForm] = useState<RailwayFormData>({
    workspaceId: '',
    projectId: '',
    environmentId: '',
    serviceId: '',
    projectName: projectName || projectId,
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

      if (selectedProvider.type === 'npanel') {
        if (!user) {
          throw new Error('You must be logged in with Nostr to deploy here.');
        }

        const npanelProvider = selectedProvider;
        const subdomain = npanelForm.subdomain.trim();
        if (!subdomain) {
          throw new Error('Choose an address for this site.');
        }

        const sourceUrl = await resolveNsiteSourceUrl(
          await git.getRemoteURL(projectPath, 'origin')
        );

        adapter = new NpanelAdapter({
          fs,
          nostr,
          signer: user.signer,
          dashboardHost: npanelProvider.dashboardHost,
          domain: npanelProvider.domain,
          subdomain,
          // The gateway serves the site, so it is also the gateway whose URL the
          // underlying nsite deploy reports.
          gateway: npanelProvider.domain,
          relayUrls: npanelProvider.relayUrls,
          blossomServers: npanelProvider.blossomServers,
          siteTitle: npanelForm.siteTitle || undefined,
          siteDescription: npanelForm.siteDescription || undefined,
          sourceUrl,
        });
      } else if (selectedProvider.type === 'nsite') {
        const nsiteProvider = selectedProvider;

        if (!user) {
          throw new Error('You must be logged in to deploy to nsite.');
        }

        const sourceUrl = await resolveNsiteSourceUrl(
          await git.getRemoteURL(projectPath, 'origin')
        );

        adapter = new NsiteAdapter({
          fs,
          nostr,
          signer: user.signer,
          gateway: nsiteProvider.gateway,
          relayUrls: nsiteProvider.relayUrls,
          blossomServers: nsiteProvider.blossomServers,
          siteTitle: nsiteForm.siteTitle || undefined,
          siteDescription: nsiteForm.siteDescription || undefined,
          sourceUrl,
          siteIdentifier: nsiteForm.dTag || undefined,
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
          esmUrl: config.esmUrl,
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
      } else if (selectedProvider.type === 'railway') {
        const railwayProvider = selectedProvider;
        if (!railwayProvider.apiKey) {
          throw new Error('Railway API token is required');
        }

        adapter = new RailwayAdapter({
          fs,
          apiKey: railwayProvider.apiKey,
          baseURL: railwayProvider.baseURL,
          workspaceId: railwayForm.workspaceId || undefined,
          projectId: railwayForm.projectId || undefined,
          environmentId: railwayForm.environmentId || undefined,
          serviceId: railwayForm.serviceId || undefined,
          projectName: railwayForm.projectName || undefined,
          corsProxy: railwayProvider.proxy ? config.corsProxy : undefined,
        });
      } else {
        throw new Error('Unknown provider type');
      }

      const result = await adapter.deploy({
        projectId,
        projectPath,
        // Later stages say what they are doing without a measure of their own,
        // so the upload figures stay up rather than the bar vanishing.
        onProgress: (next) => setProgress(prev => ({ ...prev, ...next })),
      });

      // Save project-specific settings (updateSettings now automatically sets currentProvider)
      if (selectedProvider.type === 'npanel') {
        await updateProjectSettings(selectedProviderId, {
          type: 'npanel',
          url: result.url,
          data: {
            subdomain: npanelForm.subdomain.trim() || undefined,
            siteTitle: npanelForm.siteTitle || undefined,
            siteDescription: npanelForm.siteDescription || undefined,
          },
        });
      } else if (selectedProvider.type === 'nsite') {
        await updateProjectSettings(selectedProviderId, {
          type: 'nsite',
          url: result.url,
          data: {
            siteTitle: nsiteForm.siteTitle || undefined,
            siteDescription: nsiteForm.siteDescription || undefined,
            dTag: nsiteForm.dTag || undefined,
          },
        });

        // Write .nsite/config.json for nsyte CLI interoperability.
        // This file is safe to commit — it never contains the nsec.
        const nsiteProvider = selectedProvider;
        const newNsiteVfsConfig: NsiteVfsConfig = {
          relays: nsiteProvider.relayUrls,
          servers: nsiteProvider.blossomServers,
          id: nsiteForm.dTag || undefined,
          title: nsiteForm.siteTitle || undefined,
          description: nsiteForm.siteDescription || undefined,
          fallback: '/index.html',
          gatewayHostnames: [nsiteProvider.gateway],
        };
        await writeNsiteVfsConfig(fs, projectPath, newNsiteVfsConfig);
        // Update in-memory state so summary view reflects new values immediately
        setNsiteVfsConfig(newNsiteVfsConfig);
        setNsiteShowFullForm(false);
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
      } else if (selectedProvider.type === 'railway') {
        await updateProjectSettings(selectedProviderId, {
          type: 'railway',
          url: result.url,
          data: {
            workspaceId: railwayForm.workspaceId || undefined,
            projectId: result.metadata?.projectId as string | undefined,
            environmentId: result.metadata?.environmentId as string | undefined,
            serviceId: result.metadata?.serviceId as string | undefined,
          },
        });
      }

      setDeployResult(result);

      // Update repository announcement with deployment URL if using Nostr git
      try {
        const projectPath = `${projectsPath}/${projectId}`;
        const remoteUrl = await git.getRemoteURL(projectPath, 'origin');

        if (remoteUrl && remoteUrl.startsWith('nostr://') && user) {
          const nostrURI = await NostrURI.parse(remoteUrl);

          // Query for existing repository announcement
          const existingRepos = await nostr.query(
            [{ kinds: [30617], authors: [user.pubkey], '#d': [nostrURI.identifier], limit: 1 }],
            { signal: AbortSignal.timeout(1500) }
          );

          if (existingRepos.length > 0) {
            let changed = false;
            let hasWebTag = false;

            const repoEvent = structuredClone(existingRepos[0]);

            for (const tag of repoEvent.tags) {
              if (tag[0] === 'web') {
                if (tag[1] !== result.url) {
                  tag[1] = result.url;
                  changed = true;
                  hasWebTag = true;
                }
              }
            }

            if (!hasWebTag) {
              repoEvent.tags.push(['web', result.url]);
              changed = true;
            }

            // Publish updated repo event if deployment URL changed
            if (changed) {
              // Publish the updated event
              await publishEvent(repoEvent);
            }
          }
        }
      } catch (err) {
        // Silently fail - updating web tag is not critical for deployment
        console.warn('Failed to update repository announcement with deployment URL:', err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setIsDeploying(false);
      setProgress(null);
    }
  };

  const handleClose = () => {
    setSelectedProviderId('');
    setDeployResult(null);
    setError(null);
    // Reset forms
    setNpanelForm({ subdomain: projectId, siteTitle: projectName || projectId, siteDescription: '' });
    setNsiteForm({ siteTitle: '', siteDescription: '', dTag: '' });
    setNetlifyForm({ siteId: '', siteName: '' });
    setVercelForm({ projectName: projectName || projectId, teamId: '' });
    setCloudflareForm({ projectName: projectName || projectId });
    setDenoDeployForm({ projectName: projectName || projectId });
    setRailwayForm({ workspaceId: '', projectId: '', environmentId: '', serviceId: '', projectName: projectName || projectId });
    // Return to summary mode so next open shows the compact view (if config exists)
    setNsiteShowFullForm(false);
    onClose();
  };

  const handleNpanelSubdomainChange = useCallback((subdomain: string) => {
    setNpanelForm(prev => ({ ...prev, subdomain }));
  }, []);

  const handleNpanelSiteTitleChange = useCallback((siteTitle: string) => {
    setNpanelForm(prev => ({ ...prev, siteTitle }));
  }, []);

  const handleNpanelSiteDescriptionChange = useCallback((siteDescription: string) => {
    setNpanelForm(prev => ({ ...prev, siteDescription }));
  }, []);

  const handleNpanelValidationChange = useCallback((isValid: boolean) => {
    setIsNpanelFormValid(isValid);
  }, []);

  const handleNsiteSiteTitleChange = useCallback((siteTitle: string) => {
    setNsiteForm(prev => ({ ...prev, siteTitle }));
    // Derive the dTag from the title so the user never has to think about it.
    // Falls back to projectName when the title is blank.
    projectNameToDTag(siteTitle || projectName).then(dTag => {
      setNsiteForm(prev => ({ ...prev, dTag }));
    });
  }, [projectName]);

  const handleNsiteSiteDescriptionChange = useCallback((siteDescription: string) => {
    setNsiteForm(prev => ({ ...prev, siteDescription }));
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

  const handleRailwayConfigChange = useCallback((config: {
    workspaceId: string;
    projectId: string;
    environmentId: string;
    serviceId: string;
    projectName?: string;
  }) => {
    setRailwayForm(config);
  }, []);

  const renderProviderFields = () => {
    if (!selectedProvider) return null;

    if (selectedProvider.type === 'npanel') {
      const npanelProvider = selectedProvider;
      const savedConfig = projectSettings.providers[selectedProviderId];
      const saved = savedConfig?.type === 'npanel' ? savedConfig.data : undefined;

      return (
        <NpanelDeployForm
          dashboardHost={npanelProvider.dashboardHost}
          domain={npanelProvider.domain}
          projectId={projectId}
          projectName={projectName}
          savedSubdomain={saved?.subdomain}
          savedSiteTitle={saved?.siteTitle}
          savedSiteDescription={saved?.siteDescription}
          onSubdomainChange={handleNpanelSubdomainChange}
          onSiteTitleChange={handleNpanelSiteTitleChange}
          onSiteDescriptionChange={handleNpanelSiteDescriptionChange}
          onValidationChange={handleNpanelValidationChange}
          onTakeBackSites={() => setMigratingProvider(npanelProvider)}
        />
      );
    }

    if (selectedProvider.type === 'nsite') {
      // While the .nsite/config.json load is still in flight, render nothing to avoid flicker
      if (nsiteVfsConfigLoading) return null;

      // Summary view: shown when .nsite/config.json already exists and user hasn't clicked Edit
      if (nsiteVfsConfig && !nsiteShowFullForm) {
        const relayCount = nsiteVfsConfig.relays?.length ?? 0;
        const serverCount = nsiteVfsConfig.servers?.length ?? 0;

        return (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
              {nsiteVfsConfig.title && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Title</span>
                  <span className="font-medium">{nsiteVfsConfig.title}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-muted-foreground">Relays</span>
                <span className="font-medium">{relayCount} configured</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Blossom servers</span>
                <span className="font-medium">{serverCount} configured</span>
              </div>
            </div>
            <button
              type="button"
              className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
              onClick={() => setNsiteShowFullForm(true)}
            >
              Edit site settings
            </button>
          </div>
        );
      }

      // Full config form: shown on first deploy or when user clicks "Edit site settings"
      const savedConfig = projectSettings.providers[selectedProviderId];
      const legacy = savedConfig?.type === 'nsite' ? savedConfig.data : undefined;

      // .nsite/config.json wins; .git/shakespeare/deploy.json is the legacy fallback
      const savedSiteTitle       = nsiteVfsConfig?.title       ?? legacy?.siteTitle;
      const savedSiteDescription = nsiteVfsConfig?.description ?? legacy?.siteDescription;

      return (
        <div className="space-y-3">
          <NsiteDeployForm
            key={selectedProviderId}
            projectName={projectName || projectId}
            savedNsec={legacy?.nsec}
            savedSiteTitle={savedSiteTitle}
            savedSiteDescription={savedSiteDescription}
            onSiteTitleChange={handleNsiteSiteTitleChange}
            onSiteDescriptionChange={handleNsiteSiteDescriptionChange}
          />
          {nsiteVfsConfig && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
              onClick={() => setNsiteShowFullForm(false)}
            >
              Back to summary
            </button>
          )}
        </div>
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

    if (selectedProvider.type === 'railway') {
      const railwayProvider = selectedProvider;
      const savedConfig = projectSettings.providers[selectedProviderId];
      const savedWorkspaceId = savedConfig?.type === 'railway' ? savedConfig.data.workspaceId : undefined;
      const savedProjectId = savedConfig?.type === 'railway' ? savedConfig.data.projectId : undefined;
      const savedEnvironmentId = savedConfig?.type === 'railway' ? savedConfig.data.environmentId : undefined;
      const savedServiceId = savedConfig?.type === 'railway' ? savedConfig.data.serviceId : undefined;

      return (
        <RailwayDeployForm
          apiKey={railwayProvider.apiKey}
          baseURL={railwayProvider.baseURL}
          projectId={projectId}
          projectName={projectName}
          savedWorkspaceId={savedWorkspaceId}
          savedProjectId={savedProjectId}
          savedEnvironmentId={savedEnvironmentId}
          savedServiceId={savedServiceId}
          onConfigChange={handleRailwayConfigChange}
          corsProxy={railwayProvider.proxy ? config.corsProxy : undefined}
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
                  {settings.providers.map((provider) => {
                    const preset = PRESET_DEPLOY_PROVIDERS.find(p => p.type === provider.type);
                    return (
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
                        {renderProviderIcon(provider, preset, 14)}
                        <span>{provider.name}</span>
                      </button>
                    );
                  })}
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

              {selectedProvider?.type === 'npanel' && !user && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You must be logged in with Nostr to publish a site.{' '}
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

              {selectedProvider?.type === 'nsite' && !user && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You must be logged in with Nostr to deploy to nsite.{' '}
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
                  <AlertDescription className="space-y-2">
                    {/* Errors that itemise per-file failures are newline
                        separated; a bare <p> would run them together. */}
                    <p className="whitespace-pre-line">{error}</p>
                    {/* The gateway refuses a name it is holding for this user
                        and says to take it back instead. Saying so and leaving
                        them to find out where is the worst of both. */}
                    {heldName && selectedProvider?.type === 'npanel' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setMigratingProvider(selectedProvider)}
                      >
                        Take back your sites
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {selectedProvider && (
                <Button
                  onClick={handleDeploy}
                  disabled={
                    isDeploying ||
                    (selectedProvider.type === 'npanel' && !user) ||
                    (selectedProvider.type === 'npanel' && !isNpanelFormValid) ||
                    (selectedProvider.type === 'nsite' && !user) ||
                    (selectedProvider.type === 'nsite' && !nsiteForm.dTag) ||
                    (selectedProvider.type === 'netlify' && !netlifyForm.siteId && !netlifyForm.siteName) ||
                    (selectedProvider.type === 'cloudflare' && !cloudflareForm.projectName) ||
                    (selectedProvider.type === 'deno' && !denoDeployForm.projectName) ||
                    (selectedProvider.type === 'railway' && !railwayForm.workspaceId)
                  }
                  className="w-full"
                >
                  {isDeploying ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {progress ? `${progress.stage}…` : 'Deploying...'}
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4 mr-2" />
                      Deploy
                    </>
                  )}
                </Button>
              )}

              {isDeploying && progress?.fraction !== undefined && (
                <div className="space-y-1.5" aria-live="polite">
                  <Progress value={progress.fraction * 100} className="h-2" />
                  <div className="flex justify-between gap-2 text-xs text-muted-foreground tabular-nums">
                    <span>{progress.detail}</span>
                    <span>{Math.round(progress.fraction * 100)}%</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {migratingProvider && (
        <NpanelMigrationDialog
          open
          onOpenChange={(open) => !open && setMigratingProvider(null)}
          provider={migratingProvider}
        />
      )}
    </div>
  );
}
