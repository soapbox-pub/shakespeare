import { useState, useEffect, useCallback } from 'react';
import { useFS } from './useFS';

export interface ShakespeareProjectConfig {
  type: 'shakespeare';
  data: {
    subdomain?: string;
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

export type ProjectProviderConfig = ShakespeareProjectConfig | NetlifyProjectConfig | VercelProjectConfig;

export type ProjectDeploySettings = Record<string, ProjectProviderConfig>;

/**
 * Hook to manage project-specific deployment settings
 * Stores settings in .git/shakespeare/deploy.json
 */
export function useProjectDeploySettings(projectId: string) {
  const fs = useFS();
  const [settings, setSettings] = useState<ProjectDeploySettings>({});
  const [isLoading, setIsLoading] = useState(true);

  const settingsPath = `/projects/${projectId}/.git/shakespeare/deploy.json`;

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const content = await fs.fs.readFile(settingsPath, 'utf8');
      setSettings(JSON.parse(content as string));
    } catch {
      // File doesn't exist or is invalid, use empty settings
      setSettings({});
    } finally {
      setIsLoading(false);
    }
  }, [fs.fs, settingsPath]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async (newSettings: ProjectDeploySettings) => {
    try {
      // Ensure .git/shakespeare directory exists
      const shakespeareDir = `/projects/${projectId}/.git/shakespeare`;
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
    const newSettings = { ...settings, [providerId]: config };
    await saveSettings(newSettings);
  };

  const getProviderConfig = (providerId: string): ProjectProviderConfig | undefined => {
    return settings[providerId];
  };

  return {
    settings,
    isLoading,
    updateSettings,
    saveSettings,
    getProviderConfig,
  };
}
