import { useNavigate } from 'react-router-dom';
import { Bot, GitBranch, Database, Wifi } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';

interface SettingsItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

const settingsItems: SettingsItem[] = [
  {
    id: 'ai',
    title: 'AI Settings',
    description: 'Configure AI providers and API keys',
    icon: Bot,
    href: '/settings/ai',
  },
  {
    id: 'git',
    title: 'Git Settings',
    description: 'Configure Git credentials for HTTP authentication',
    icon: GitBranch,
    href: '/settings/git',
  },
  {
    id: 'nostr',
    title: 'Nostr Settings',
    description: 'Configure relay connections and Nostr preferences',
    icon: Wifi,
    href: '/settings/nostr',
  },
  {
    id: 'data',
    title: 'Data',
    description: 'Export files and manage local data',
    icon: Database,
    href: '/settings/data',
  },
];

export function Settings() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="p-6 space-y-4">
        <div className="space-y-2">
          <h2 className="text-xl font-bold">Settings</h2>
          <p className="text-muted-foreground">
            Manage your application settings and preferences.
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