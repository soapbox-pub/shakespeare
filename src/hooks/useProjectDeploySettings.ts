import { useState, useEffect, useCallback } from 'react';
import { useFS } from './useFS';
import { useFSPaths } from './useFSPaths';

export interface ShakespeareProjectConfig {
  type: 'shakespeare';
  data: {
    subdomain?: string;
  };
}

export interface NsiteProjectConfig {
  type: 'nsite';
  data: {
    nsec: string;
  };
}

export interface NetlifyProjectConfig {
  type: 'netlify';
  data: {
    siteId?: string;
  };
}

export interface VercelProjectConfig {
  type: 'vercel';
  data: {
    teamId?: string;
    projectId?: string;
  };
}

export interface CloudflareProjectConfig {
  type: 'cloudflare';
  data: {
    projectName?: string;
  };
}

export interface DenoDeployProjectConfig {
  type: 'deno';
  data: {
    projectName?: string;
  };
}

export type ProjectProviderConfig = ShakespeareProjectConfig | NsiteProjectConfig | NetlifyProjectConfig | VercelProjectConfig | CloudflareProjectConfig | DenoDeployProjectConfig;

export interface ProjectDeploySettings {
  providers: Record<string, ProjectProviderConfig>;
  currentProvider?: string;
}

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

      // Handle migration from old format (flat Record) to new format (with providers key)
      if (parsed && typeof parsed === 'object' && !('providers' in parsed)) {
        // Old format: Record<string, ProjectProviderConfig>
        // Migrate to new format
        setSettings({ providers: parsed });
      } else {
        // New format or empty
        setSettings(parsed || { providers: {} });
      }
    } catch {
      // File doesn't exist or is invalid, use empty settings
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
