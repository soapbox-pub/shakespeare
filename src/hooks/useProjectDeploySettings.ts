import { useState, useEffect, useCallback } from 'react';
import { useFS } from './useFS';

export interface ProjectDeploySettings {
  providerId?: string;
  netlify?: {
    siteId?: string;
  };
  vercel?: {
    teamId?: string;
    projectId?: string;
  };
}

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

  const updateSettings = async (updates: Partial<ProjectDeploySettings>) => {
    const newSettings = { ...settings, ...updates };
    await saveSettings(newSettings);
  };

  return {
    settings,
    isLoading,
    updateSettings,
    saveSettings,
  };
}
