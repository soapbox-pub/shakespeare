import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Download, ExternalLink, Loader2, Check, Globe, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDiscoverPlugins } from '@/hooks/useDiscoverPlugins';
import { usePlugins } from '@/hooks/usePlugins';
import { useAuthor } from '@/hooks/useAuthor';
import { useToast } from '@/hooks/useToast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { genUserName } from '@/lib/genUserName';
import type { NostrMetadata } from '@nostrify/nostrify';

interface DiscoverPluginsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DiscoverPluginsDialog({ open, onOpenChange }: DiscoverPluginsDialogProps) {
  const { t } = useTranslation();
  const { data: plugins, isLoading } = useDiscoverPlugins();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter plugins based on search query
  const filteredPlugins = plugins?.filter((plugin) => {
    const query = searchQuery.toLowerCase();
    return (
      plugin.name.toLowerCase().includes(query) ||
      plugin.description.toLowerCase().includes(query) ||
      plugin.id.toLowerCase().includes(query)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {t('discoverPlugins')}
          </DialogTitle>
          <DialogDescription>
            {t('discoverPluginsDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('searchPlugins')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Plugins List */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {isLoading && (
              <>
                {[...Array(3)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}

            {!isLoading && filteredPlugins?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery ? t('noPluginsFound') : t('noPluginsAvailable')}
              </div>
            )}

            {!isLoading && filteredPlugins?.map((plugin) => (
              <PluginCard key={`${plugin.author}-${plugin.id}`} plugin={plugin} />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface PluginCardProps {
  plugin: {
    id: string;
    name: string;
    description: string;
    cloneUrl?: string;
    webUrl?: string;
    author: string;
  };
}

function PluginCard({ plugin }: PluginCardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const author = useAuthor(plugin.author);
  const { clonePlugin, plugins: installedPlugins } = usePlugins();
  const metadata: NostrMetadata | undefined = author.data?.metadata;

  const isInstalled = installedPlugins.includes(plugin.id);
  const isInstalling = clonePlugin.isPending && clonePlugin.variables?.pluginName === plugin.id;

  const handleInstall = async () => {
    if (!plugin.cloneUrl) {
      toast({
        title: t('noCloneUrl'),
        description: t('noCloneUrlDescription'),
        variant: 'destructive',
      });
      return;
    }

    try {
      await clonePlugin.mutateAsync({
        gitUrl: plugin.cloneUrl,
        pluginName: plugin.id,
      });
      toast({
        title: t('pluginInstalled'),
        description: t('pluginInstalledDescription', { name: plugin.name }),
      });
    } catch (error) {
      toast({
        title: t('pluginInstallFailed'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    }
  };

  const displayName = metadata?.name ?? genUserName(plugin.author);
  const profileImage = metadata?.picture;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Plugin Header with Author Info */}
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profileImage} alt={displayName} />
            <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-base truncate">{plugin.name}</h3>
              {isInstalled && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 rounded-full">
                  <Check className="h-3 w-3" />
                  {t('installed')}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('by')} {displayName}
            </p>
          </div>
        </div>

        {/* Plugin Description */}
        {plugin.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {plugin.description}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleInstall}
            disabled={isInstalled || isInstalling || !plugin.cloneUrl}
            className="flex-1"
            size="sm"
          >
            {isInstalling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('installing')}
              </>
            ) : isInstalled ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                {t('installed')}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                {t('install')}
              </>
            )}
          </Button>
          {plugin.webUrl && (
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a
                href={plugin.webUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Globe className="h-4 w-4 mr-2" />
                {t('website')}
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
