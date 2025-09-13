import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon, Bot, GitBranch } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Settings() {
  const navigate = useNavigate();

  const settingsItems = [
    {
      title: 'AI Settings',
      description: 'Configure AI providers and API keys',
      icon: Bot,
      href: '/settings/ai',
    },
    {
      title: 'Git Settings',
      description: 'Configure Git credentials for HTTP authentication',
      icon: GitBranch,
      href: '/settings/git',
    },
  ];

  return (
    <AppLayout title="Settings" showSidebar={true}>
      <div className="max-w-4xl mx-auto">
        <Card className="bg-white">
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <SettingsIcon className="h-8 w-8 text-primary" />
                Settings
              </h1>
              <p className="text-muted-foreground">
                Manage your application settings and preferences.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {settingsItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Card
                    key={item.href}
                    className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] hover:border-primary/20"
                    onClick={() => navigate(item.href)}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-primary" />
                        {item.title}
                      </CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full">
                        Configure
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export default Settings;