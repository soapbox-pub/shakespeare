import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bot, GitBranch, Database, Wifi, Settings2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';

interface SettingsItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

// Define settings items as a function to get fresh translations
const getSettingsItems = (t: (key: string) => string): SettingsItem[] => [
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
    id: 'nostr',
    title: t('nostrSettings'),
    description: t('nostrSettingsDescription'),
    icon: Wifi,
    href: '/settings/nostr',
  },
  {
    id: 'data',
    title: t('dataSettings'),
    description: t('dataSettingsDescription'),
    icon: Database,
    href: '/settings/data',
  },
];

export function Settings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const settingsItems = getSettingsItems(t);

  if (isMobile) {
    return (
      <div className="p-6 space-y-4">
        <div className="space-y-2">
          <h2 className="text-xl font-bold">{t('settings')}</h2>
          <p className="text-muted-foreground">
            {t('settingsDescription')}
          </p>
        </div>
        <div className="space-y-3">
          {settingsItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 p-4 rounded-lg border hover:border-primary/20 hover:bg-primary/5 cursor-pointer transition-colors"
                onClick={() => navigate(item.href)}
              >
                <Icon className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-muted-foreground">{item.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
}

export default Settings;