import type { JSRuntimeFS } from '@/lib/JSRuntime';
import type { AISettings, AIProvider } from '@/contexts/AISettingsContext';
import type { GitSettings } from '@/contexts/GitSettingsContext';

const CONFIG_DIR = '/config';
const AI_CONFIG_PATH = `${CONFIG_DIR}/ai.json`;
const GIT_CONFIG_PATH = `${CONFIG_DIR}/git.json`;

/**
 * Ensures the config directory exists
 */
async function ensureConfigDir(fs: JSRuntimeFS): Promise<void> {
  try {
    await fs.stat(CONFIG_DIR);
  } catch {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Migrate AI settings from localStorage to VFS (internal function)
 */
async function migrateAISettingsFromLocalStorage(fs: JSRuntimeFS): Promise<AISettings | null> {
  // If not in VFS, try to migrate from localStorage
  const stored = localStorage.getItem('ai-settings');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && 'providers' in parsed) {
        // Handle migration from old map format to new array format
        let providers;
        if (Array.isArray(parsed.providers)) {
          providers = parsed.providers;
        } else if (parsed.providers && typeof parsed.providers === 'object') {
          // Convert map to array
          providers = Object.entries(parsed.providers).map(([id, connection]) => ({
            id,
            ...(connection as Omit<AIProvider, 'id'>),
          }));
        } else {
          providers = [];
        }

        const settings: AISettings = {
          providers,
          recentlyUsedModels: parsed.recentlyUsedModels || [],
        };

        // Write to VFS and remove from localStorage
        await writeAISettings(fs, settings);
        localStorage.removeItem('ai-settings');

        return settings;
      }
    } catch {
      // If parsing fails, return null
    }
  }

  return null;
}

/**
 * Read AI settings from VFS (with automatic migration from localStorage)
 */
export async function readAISettings(fs: JSRuntimeFS): Promise<AISettings> {
  const defaultSettings: AISettings = {
    providers: [],
    recentlyUsedModels: [],
  };

  // Try to read from VFS first
  try {
    const content = await fs.readFile(AI_CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(content);

    if (parsed && typeof parsed === 'object' && 'providers' in parsed) {
      // Handle migration from old map format to new array format
      let providers;
      if (Array.isArray(parsed.providers)) {
        providers = parsed.providers;
      } else if (parsed.providers && typeof parsed.providers === 'object') {
        // Convert map to array
        providers = Object.entries(parsed.providers).map(([id, connection]) => ({
          id,
          ...(connection as Omit<AIProvider, 'id'>),
        }));

        // Write back the migrated format
        const migratedSettings: AISettings = {
          providers,
          recentlyUsedModels: parsed.recentlyUsedModels || [],
        };
        await writeAISettings(fs, migratedSettings);
        return migratedSettings;
      } else {
        providers = [];
      }

      return {
        providers,
        recentlyUsedModels: parsed.recentlyUsedModels || [],
      };
    }
  } catch {
    // File doesn't exist or is invalid, try migration
  }

  // If not in VFS, try to migrate from localStorage
  const migratedSettings = await migrateAISettingsFromLocalStorage(fs);
  if (migratedSettings) {
    return migratedSettings;
  }

  return defaultSettings;
}

/**
 * Write AI settings to VFS
 */
export async function writeAISettings(fs: JSRuntimeFS, settings: AISettings): Promise<void> {
  await ensureConfigDir(fs);
  await fs.writeFile(AI_CONFIG_PATH, JSON.stringify(settings, null, 2), 'utf8');
}

/**
 * Migrate Git settings from localStorage to VFS (internal function)
 */
async function migrateGitSettingsFromLocalStorage(fs: JSRuntimeFS): Promise<GitSettings | null> {
  // If not in VFS, try to migrate from localStorage
  const stored = localStorage.getItem('git-settings');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && 'credentials' in parsed) {
        const settings: GitSettings = {
          credentials: parsed.credentials || {},
          corsProxy: parsed.corsProxy || 'https://cors.isomorphic-git.org',
        };

        // Write to VFS and remove from localStorage
        await writeGitSettings(fs, settings);
        localStorage.removeItem('git-settings');

        return settings;
      }
    } catch {
      // If parsing fails, return null
    }
  }

  return null;
}

/**
 * Read Git settings from VFS (with automatic migration from localStorage)
 */
export async function readGitSettings(fs: JSRuntimeFS): Promise<GitSettings> {
  const defaultSettings: GitSettings = {
    credentials: {},
    corsProxy: 'https://cors.isomorphic-git.org',
  };

  // Try to read from VFS first
  try {
    const content = await fs.readFile(GIT_CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(content);

    if (parsed && typeof parsed === 'object' && 'credentials' in parsed) {
      return {
        credentials: parsed.credentials || {},
        corsProxy: parsed.corsProxy || 'https://cors.isomorphic-git.org',
      };
    }
  } catch {
    // File doesn't exist or is invalid, try migration
  }

  // If not in VFS, try to migrate from localStorage
  const migratedSettings = await migrateGitSettingsFromLocalStorage(fs);
  if (migratedSettings) {
    return migratedSettings;
  }

  return defaultSettings;
}

/**
 * Write Git settings to VFS
 */
export async function writeGitSettings(fs: JSRuntimeFS, settings: GitSettings): Promise<void> {
  await ensureConfigDir(fs);
  await fs.writeFile(GIT_CONFIG_PATH, JSON.stringify(settings, null, 2), 'utf8');
}

