import { ReactNode, useEffect } from 'react';
import { z } from 'zod';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { AppContext, type AppConfig, type AppContextType, type Theme, type RelayMetadata, type GraspMetadata } from '@/contexts/AppContext';
import i18n from '@/lib/i18n';

interface AppProviderProps {
  children: ReactNode;
  /** Application storage key */
  storageKey: string;
  /** Default app configuration */
  defaultConfig: AppConfig;
}

// Zod schema for RelayMetadata
const RelayMetadataSchema = z.object({
  relays: z.array(z.object({
    url: z.string().url(),
    read: z.boolean(),
    write: z.boolean(),
  })),
  updatedAt: z.number(),
}) satisfies z.ZodType<RelayMetadata>;

// Zod schema for GraspMetadata
const GraspMetadataSchema = z.object({
  relays: z.array(z.object({
    url: z.string().url(),
  })),
  updatedAt: z.number(),
}) satisfies z.ZodType<GraspMetadata>;

// Zod schema for ProjectTemplate
const ProjectTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  url: z.string().url(),
});

// Zod schema for AppConfig validation
const AppConfigSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']),
  relayMetadata: RelayMetadataSchema,
  graspMetadata: GraspMetadataSchema,
  templates: z.array(ProjectTemplateSchema),
  esmUrl: z.string().url(),
  corsProxy: z.string().url(),
  faviconUrl: z.string().url(),
  previewDomain: z.string().min(1),
  language: z.string(),
  showcaseEnabled: z.boolean(),
  showcaseModerator: z.string(),
  fsPathProjects: z.string().min(1),
  fsPathConfig: z.string().min(1),
  fsPathTmp: z.string().min(1),
  fsPathPlugins: z.string().min(1),
  fsPathTemplates: z.string().min(1),
  sentryDsn: z.string(),
  sentryEnabled: z.boolean(),
  systemPrompt: z.string(),
}) satisfies z.ZodType<AppConfig>;

export function AppProvider(props: AppProviderProps) {
  const {
    children,
    storageKey,
    defaultConfig,
  } = props;

  // App configuration state with localStorage persistence
  const [rawConfig, setConfig] = useLocalStorage<Partial<AppConfig>>(
    storageKey,
    {},
    {
      serialize: JSON.stringify,
      deserialize: (value: string) => {
        const parsed = JSON.parse(value);
        return AppConfigSchema.partial().parse(parsed);
      }
    }
  );

  // Generic config updater with callback pattern
  const updateConfig = (updater: (currentConfig: Partial<AppConfig>) => Partial<AppConfig>) => {
    setConfig(updater);
  };

  // Merge default config with stored config
  const config = { ...defaultConfig, ...rawConfig };

  // Expand filesystem paths
  config.fsPathConfig = expandPath(config.fsPathConfig);
  config.fsPathProjects = expandPath(config.fsPathProjects);
  config.fsPathTmp = expandPath(config.fsPathTmp);
  config.fsPathPlugins = expandPath(config.fsPathPlugins);
  config.fsPathTemplates = expandPath(config.fsPathTemplates);

  const appContextValue: AppContextType = {
    config,
    defaultConfig,
    updateConfig,
  };

  // Apply theme effects to document
  useApplyTheme(config.theme);

  // Apply language effects to i18n
  useApplyLanguage(config.language);

  return (
    <AppContext.Provider value={appContextValue}>
      {children}
    </AppContext.Provider>
  );
}

/**
 * Hook to apply theme changes to the document root
 */
function useApplyTheme(theme: Theme) {
  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  // Handle system theme changes when theme is set to "system"
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');

      const systemTheme = mediaQuery.matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);
}

/**
 * Hook to apply language changes to i18n
 */
function useApplyLanguage(language?: string): void {
  useEffect(() => {
    i18n.changeLanguage(language ?? navigator.language);
  }, [language]);
}

/** Expand FS paths with the user's home directory, if available. */
function expandPath(path: string): string {
  const homedir = window.electron?.homedir;
  if (!homedir) {
    return path;
  } else if (path.startsWith('~/')) {
    return homedir + path.slice(1);
  } else if (path === '~') {
    return homedir;
  } else {
    return path;
  }
}