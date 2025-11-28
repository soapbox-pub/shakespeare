import { Bot, GitBranch, Database, Wifi, Settings2, Info, Settings, Rocket } from 'lucide-react';

export interface SettingsItemConfig {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  titleKey: string;
  href: string;
}

export interface SettingsCategoryConfig {
  id: string;
  titleKey: string;
  items: SettingsItemConfig[];
}

/**
 * Settings structure organized by category
 */
export const settingsCategories: SettingsCategoryConfig[] = [
  {
    id: 'general',
    titleKey: 'general',
    items: [
      {
        id: 'preferences',
        icon: Settings2,
        titleKey: 'preferences',
        href: '/settings/preferences',
      },
    ],
  },
  {
    id: 'integrations',
    titleKey: 'integrations',
    items: [
      {
        id: 'ai',
        icon: Bot,
        titleKey: 'aiSettings',
        href: '/settings/ai',
      },
      {
        id: 'git',
        icon: GitBranch,
        titleKey: 'gitSettings',
        href: '/settings/git',
      },
      {
        id: 'nostr',
        icon: Wifi,
        titleKey: 'nostrSettings',
        href: '/settings/nostr',
      },
      {
        id: 'deploy',
        icon: Rocket,
        titleKey: 'deploySettings',
        href: '/settings/deploy',
      },
    ],
  },
  {
    id: 'advanced',
    titleKey: 'advanced',
    items: [
      {
        id: 'storage',
        icon: Database,
        titleKey: 'storageSettings',
        href: '/settings/storage',
      },
      {
        id: 'system',
        icon: Settings,
        titleKey: 'systemSettings',
        href: '/settings/system',
      },
      {
        id: 'about',
        icon: Info,
        titleKey: 'aboutShakespeare',
        href: '/settings/about',
      },
    ],
  },
];
