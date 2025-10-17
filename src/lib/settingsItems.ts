import { Bot, GitBranch, Database, Wifi, Settings2, Info, Settings, Rocket } from 'lucide-react';

export interface SettingsItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

/**
 * Get the list of settings items with translations
 * @param t - Translation function from useTranslation hook
 * @returns Array of settings items
 */
export const getSettingsItems = (t: (key: string) => string): SettingsItem[] => [
  {
    id: 'preferences',
    title: t('preferences'),
    description: t('preferencesDescription'),
    icon: Settings2,
    href: '/settings/preferences',
  },
  {
    id: 'ai',
    title: t('aiSettings'),
    description: t('aiSettingsDescription'),
    icon: Bot,
    href: '/settings/ai',
  },
  {
    id: 'git',
    title: t('gitSettings'),
    description: t('gitSettingsDescription'),
    icon: GitBranch,
    href: '/settings/git',
  },
  {
    id: 'deploy',
    title: t('deploySettings'),
    description: t('deploySettingsDescription'),
    icon: Rocket,
    href: '/settings/deploy',
  },
  {
    id: 'nostr',
    title: t('nostrSettings'),
    description: t('nostrSettingsDescription'),
    icon: Wifi,
    href: '/settings/nostr',
  },
  {
    id: 'storage',
    title: t('storageSettings'),
    description: t('storageSettingsDescription'),
    icon: Database,
    href: '/settings/storage',
  },
  {
    id: 'system',
    title: t('systemSettings'),
    description: t('systemSettingsDescription'),
    icon: Settings,
    href: '/settings/system',
  },
  {
    id: 'about',
    title: t('aboutShakespeare'),
    description: t('aboutShakespeareDescription'),
    icon: Info,
    href: '/settings/about',
  },
];
