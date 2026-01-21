import { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { useFS } from './useFS';
import { useFSPaths } from './useFSPaths';

const shakespeareProjectConfigSchema = z.object({
  type: z.literal('shakespeare'),
  url: z.string(),
  data: z.object({
    subdomain: z.string().optional(),
  }),
});

const nsiteProjectConfigSchema = z.object({
  type: z.literal('nsite'),
  url: z.string(),
  data: z.object({
    nsec: z.string(),
  }),
});

const netlifyProjectConfigSchema = z.object({
  type: z.literal('netlify'),
  url: z.string(),
  data: z.object({
    siteId: z.string().optional(),
  }),
});

const vercelProjectConfigSchema = z.object({
  type: z.literal('vercel'),
  url: z.string(),
  data: z.object({
    teamId: z.string().optional(),
    projectId: z.string().optional(),
  }),
});

const cloudflareProjectConfigSchema = z.object({
  type: z.literal('cloudflare'),
  url: z.string(),
  data: z.object({
    projectName: z.string().optional(),
  }),
});

const denoDeployProjectConfigSchema = z.object({
  type: z.literal('deno'),
  url: z.string(),
  data: z.object({
    projectName: z.string().optional(),
  }),
});

const railwayProjectConfigSchema = z.object({
  type: z.literal('railway'),
  url: z.string(),
  data: z.object({
    workspaceId: z.string().optional(),
    projectId: z.string().optional(),
    environmentId: z.string().optional(),
    serviceId: z.string().optional(),
  }),
});

const projectProviderConfigSchema = z.discriminatedUnion('type', [
  shakespeareProjectConfigSchema,
  nsiteProjectConfigSchema,
  netlifyProjectConfigSchema,
  vercelProjectConfigSchema,
  cloudflareProjectConfigSchema,
  denoDeployProjectConfigSchema,
  railwayProjectConfigSchema,
]);

const projectDeploySettingsSchema = z.object({
  providers: z.record(z.string(), projectProviderConfigSchema),
  currentProvider: z.string().optional(),
});

export type ShakespeareProjectConfig = z.infer<typeof shakespeareProjectConfigSchema>;
export type NsiteProjectConfig = z.infer<typeof nsiteProjectConfigSchema>;
export type NetlifyProjectConfig = z.infer<typeof netlifyProjectConfigSchema>;
export type VercelProjectConfig = z.infer<typeof vercelProjectConfigSchema>;
export type CloudflareProjectConfig = z.infer<typeof cloudflareProjectConfigSchema>;
export type DenoDeployProjectConfig = z.infer<typeof denoDeployProjectConfigSchema>;
export type RailwayProjectConfig = z.infer<typeof railwayProjectConfigSchema>;
export type ProjectProviderConfig = z.infer<typeof projectProviderConfigSchema>;
export type ProjectDeploySettings = z.infer<typeof projectDeploySettingsSchema>;

/**
 * Hook to manage project-specific deployment settings
 * Stores settings in .git/shakespeare/deploy.json
 */
export function useProjectDeploySettings(projectId: string | null) {
  const fs = useFS();
  const { projectsPath } = useFSPaths();
  const [settings, setSettings] = useState<ProjectDeploySettings>({ providers: {} });
  const [isLoading, setIsLoading] = useState(true);

  const settingsPath = `${projectsPath}/${projectId}/.git/shakespeare/deploy.json`;

  const loadSettings = useCallback(async () => {
    // Don't try to load if projectId is falsy
    if (!projectId) {
      setSettings({ providers: {} });
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const content = await fs.fs.readFile(settingsPath, 'utf8');
      const parsed = JSON.parse(content as string);

      // Validate with Zod
      const validated = projectDeploySettingsSchema.parse(parsed);
      setSettings(validated);
    } catch (error) {
      // File doesn't exist, is invalid JSON, or doesn't match schema - use empty settings
      if (error instanceof Error && !error.message.includes('ENOENT')) {
        console.warn('Failed to load or validate deploy settings:', error);
      }
      setSettings({ providers: {} });
    } finally {
      setIsLoading(false);
    }
  }, [fs.fs, settingsPath, projectId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async (newSettings: ProjectDeploySettings) => {
    if (!projectId) {
      throw new Error('Cannot save settings: no project selected');
    }

    try {
      // Ensure .git/shakespeare directory exists
      const shakespeareDir = `${projectsPath}/${projectId}/.git/shakespeare`;
      try {
        await fs.fs.stat(shakespeareDir);
      } catch {
        await fs.fs.mkdir(shakespeareDir, { recursive: true });
      }

      // Save settings
      await fs.fs.writeFile(settingsPath, JSON.stringify(newSettings, null, 2), 'utf8');
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to save deploy settings:', error);
      throw error;
    }
  };

  const updateSettings = async (providerId: string, config: ProjectProviderConfig) => {
    const newSettings = {
      ...settings,
      providers: { ...settings.providers, [providerId]: config },
      currentProvider: providerId,
    };
    await saveSettings(newSettings);
  };

  const getProviderConfig = (providerId: string): ProjectProviderConfig | undefined => {
    return settings.providers[providerId];
  };

  return {
    settings,
    isLoading,
    updateSettings,
    saveSettings,
    getProviderConfig,
  };
}
