import { Bot, GitBranch, Database, Wifi, Settings2, Info, Settings, Rocket } from 'lucide-react';

export interface SettingsItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  href: string;
}

export interface SettingsCategory {
  id: string;
  title: string;
  items: SettingsItem[];
}

/**
 * Get the categorized list of settings items with translations
 * @param t - Translation function from useTranslation hook
 * @returns Array of settings categories with translated items
 */
export const getSettingsCategories = (t: (key: string) => string): SettingsCategory[] => [
  {
    id: 'general',
    title: t('general'),
    items: [
      {
        id: 'preferences',
        icon: Settings2,
        title: t('preferences'),
        href: '/settings/preferences',
      },
    ],
  },
  {
    id: 'integrations',
    title: t('integrations'),
    items: [
      {
        id: 'ai',
        icon: Bot,
        title: t('aiSettings'),
        href: '/settings/ai',
      },
      {
        id: 'git',
        icon: GitBranch,
        title: t('gitSettings'),
        href: '/settings/git',
      },
      {
        id: 'deploy',
        icon: Rocket,
        title: t('deploySettings'),
        href: '/settings/deploy',
      },
      {
        id: 'nostr',
        icon: Wifi,
        title: t('nostrSettings'),
        href: '/settings/nostr',
      },
    ],
  },
  {
    id: 'advanced',
    title: t('advanced'),
    items: [
      {
        id: 'storage',
        icon: Database,
        title: t('storageSettings'),
        href: '/settings/storage',
      },
      {
        id: 'system',
        icon: Settings,
        title: t('systemSettings'),
        href: '/settings/system',
      },
      {
        id: 'about',
        icon: Info,
        title: t('aboutShakespeare'),
        href: '/settings/about',
      },
    ],
  },
];
