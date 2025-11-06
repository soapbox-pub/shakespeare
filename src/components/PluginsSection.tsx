import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Puzzle, Plus, Trash2, RefreshCw, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { usePlugins } from '@/hooks/usePlugins';
import { usePluginGitInfo } from '@/hooks/usePluginGitInfo';
import { useToast } from '@/hooks/useToast';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function PluginsSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { plugins, skills, clonePlugin, syncPlugin, deletePlugin } = usePlugins();
  const [gitUrl, setGitUrl] = useState('');

  const handleAddPlugin = async () => {
    if (!gitUrl.trim()) return;

    try {
      const pluginName = await clonePlugin.mutateAsync({ gitUrl: gitUrl.trim() });
      toast({
        title: t('pluginAdded'),
        description: t('pluginAddedDescription', { name: pluginName }),
      });
      setGitUrl('');
    } catch (error) {
      toast({
        title: t('pluginAddFailed'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    }
  };

  const handleSyncPlugin = async (pluginName: string) => {
    try {
      await syncPlugin.mutateAsync(pluginName);
      toast({
        title: t('pluginSynced'),
        description: t('pluginSyncedDescription', { name: pluginName }),
      });
    } catch (error) {
      toast({
        title: t('pluginSyncFailed'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    }
  };

  const handleDeletePlugin = async (pluginName: string) => {
    try {
      await deletePlugin.mutateAsync(pluginName);
      toast({
        title: t('pluginDeleted'),
        description: t('pluginDeletedDescription', { name: pluginName }),
      });
    } catch (error) {
      toast({
        title: t('pluginDeleteFailed'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    }
  };

  // Group skills by plugin
  const skillsByPlugin = skills.reduce((acc, skill) => {
    if (!acc[skill.plugin]) {
      acc[skill.plugin] = [];
    }
    acc[skill.plugin].push(skill);
    return acc;
  }, {} as Record<string, typeof skills>);

  return (
    <div className="space-y-4">
      {/* Divider */}
      <Separator className="my-6" />

      {/* Plugins Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Puzzle className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{t('plugins')}</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('pluginsDescription')}
        </p>
      </div>

      {/* Configured Plugins List */}
      {plugins.length > 0 ? (
        <div className="space-y-2">
          {plugins.map((pluginName) => {
            const pluginSkills = skillsByPlugin[pluginName] || [];
            const isSyncing = syncPlugin.isPending && syncPlugin.variables === pluginName;
            const isDeleting = deletePlugin.isPending && deletePlugin.variables === pluginName;

            return <PluginItem
              key={pluginName}
              pluginName={pluginName}
              pluginSkills={pluginSkills}
              isSyncing={isSyncing}
              isDeleting={isDeleting}
              onSync={handleSyncPlugin}
              onDelete={handleDeletePlugin}
            />;
          })}
        </div>
      ) : (
        <Alert>
          <AlertDescription className="text-sm">
            {t('noPluginsConfigured')}
          </AlertDescription>
        </Alert>
      )}

      {/* Add Plugin Section */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="add-plugin" className="border rounded-lg">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">{t('addPlugin')}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="plugin-git-url">{t('gitRepositoryUrl')}</Label>
                <Input
                  id="plugin-git-url"
                  placeholder="https://github.com/user/plugin.git"
                  value={gitUrl}
                  onChange={(e) => setGitUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && gitUrl.trim()) {
                      handleAddPlugin();
                    }
                  }}
                />
              </div>
              <Button
                onClick={handleAddPlugin}
                disabled={!gitUrl.trim() || clonePlugin.isPending}
                className="gap-2 w-full"
              >
                {clonePlugin.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('cloning')}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {t('addPlugin')}
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t('pluginDescription')}
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

interface PluginItemProps {
  pluginName: string;
  pluginSkills: Array<{ name: string; description: string; path: string; plugin: string }>;
  isSyncing: boolean;
  isDeleting: boolean;
  onSync: (pluginName: string) => void;
  onDelete: (pluginName: string) => void;
}

function PluginItem({ pluginName, pluginSkills, isSyncing, isDeleting, onSync, onDelete }: PluginItemProps) {
  const { t } = useTranslation();
  const { data: gitInfo } = usePluginGitInfo(pluginName);

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value={pluginName} className="border rounded-lg">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="flex items-center gap-2">
            <Puzzle className="h-4 w-4 text-primary" />
            <span className="font-medium">{pluginName}</span>
            {pluginSkills.length > 0 && (
              <span className="text-xs text-muted-foreground">
                ({pluginSkills.length} {pluginSkills.length === 1 ? 'skill' : 'skills'})
              </span>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-3">
            {/* Skills List */}
            {pluginSkills.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t('skills')}</Label>
                <div className="space-y-1">
                  {pluginSkills.map((skill) => (
                    <div
                      key={skill.name}
                      className="flex items-start gap-2 p-2 rounded-md bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium font-mono">{skill.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {skill.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pluginSkills.length === 0 && (
              <Alert>
                <AlertDescription className="text-xs">
                  {t('noSkillsFound')}
                </AlertDescription>
              </Alert>
            )}

            {/* Plugin Actions and Git Info */}
            <div className="space-y-2 pt-2">
              {gitInfo && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <code className="bg-muted px-1.5 py-0.5 rounded">{gitInfo.commitHash.substring(0, 7)}</code>
                  <span>•</span>
                  <span>{gitInfo.commitDate.toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSync(pluginName)}
                  disabled={isSyncing || isDeleting}
                  className="flex-1"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('syncing')}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {t('sync')}
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(pluginName)}
                  disabled={isSyncing || isDeleting}
                  className="flex-1"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('deleting')}
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('delete')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
