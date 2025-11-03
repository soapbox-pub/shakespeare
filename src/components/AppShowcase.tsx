import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAppSubmissions } from "@/hooks/useAppSubmissions";
import { AppShowcaseCard } from "@/components/AppShowcaseCard";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { nip19 } from 'nostr-tools';
import { shuffleArray } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { RelaySelector } from "@/components/RelaySelector";
import { useAppContext } from "@/hooks/useAppContext";
import { useTranslation } from 'react-i18next';

export function AppShowcase() {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { config } = useAppContext();
  const { data: submissions = [], isLoading } = useAppSubmissions();
  const [showAllApps, setShowAllApps] = useState(false);

  // Get moderator hex from config
  const MODERATOR_HEX = useMemo(() => {
    try {
      const decoded = nip19.decode(config.showcaseModerator);
      return decoded.type === 'npub' ? decoded.data : '';
    } catch {
      return '';
    }
  }, [config.showcaseModerator]);
  const isModerator = user?.pubkey === MODERATOR_HEX;

  // Filter and shuffle submissions - memoized with stable dependency
  const { templateApps, featuredApps, approvedApps } = useMemo(() => {
    // Filter visible submissions
    const visibleSubmissions = submissions.filter(app => !app.isHidden);

    // Separate template apps from other apps
    const templates = shuffleArray(visibleSubmissions.filter(app => app.appTags.includes('Template')));
    const nonTemplateSubmissions = visibleSubmissions.filter(app => !app.appTags.includes('Template'));

    // Shuffle featured and approved apps for random display order
    const featured = shuffleArray(nonTemplateSubmissions.filter(app => app.isFeatured));
    const approved = shuffleArray(nonTemplateSubmissions.filter(app => app.isApproved && !app.isFeatured));

    return {
      templateApps: templates,
      featuredApps: featured,
      approvedApps: approved,
    };
  }, [submissions]); // Only depend on submissions, not intermediate filtered arrays

  // Don't show showcase if disabled in settings
  if (!config.showcaseEnabled) {
    return null;
  }

  // Don't show showcase if no apps exist
  if (isLoading) {
    return (
      <div className="mt-16 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-full flex flex-col">
              <Skeleton className="aspect-video rounded-t-lg" />
              <CardContent className="p-6 flex flex-col flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <Skeleton className="w-12 h-12 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
                <div className="flex gap-1 mb-4">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <div className="mt-auto flex gap-2">
                  <Skeleton className="h-6 flex-1" />
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!submissions.length) {
    return (
      <div className="mt-16 max-w-7xl mx-auto">
        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center">
            <div className="max-w-sm mx-auto space-y-6">
              <p className="text-muted-foreground">
                {t('noAppsFound')}
              </p>
              <RelaySelector className="w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-16 max-w-7xl mx-auto">
      {/* Apps Grid */}
      <div className="space-y-12">
        {/* Featured Apps */}
        {featuredApps.length > 0 && (
          <div>
            <div className="flex items-start gap-3 mb-6">
              <div className="flex-none w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                <span className="text-sm">⭐</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">{t('featuredApps')}</h3>
                <p className="text-sm text-muted-foreground">{t('featuredAppsDescription')}</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredApps.slice(0, 6).map((app) => (
                <AppShowcaseCard
                  key={app.id}
                  app={app}
                  showModerationControls={isModerator}
                  hideApprovalStatus={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* Templates Section */}
        {templateApps.length > 0 && (
          <div>
            <div className="flex items-start gap-3 mb-6">
              <div className="flex-none w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <span className="text-sm">📋</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">{t('templates')}</h3>
                <p className="text-sm text-muted-foreground">{t('templatesDescription')}</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templateApps.slice(0, 6).map((app) => (
                <AppShowcaseCard
                  key={app.id}
                  app={app}
                  showModerationControls={isModerator}
                  hideApprovalStatus={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* More Apps (Approved) - Collapsible */}
        {approvedApps.length > 0 && (
          <div>
            <Collapsible open={showAllApps} onOpenChange={setShowAllApps}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="p-0 h-auto mb-6 hover:bg-transparent">
                  <div className="flex items-start gap-3">
                    <div className="flex-none w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
                      <span className="text-sm">📱</span>
                    </div>
                    <div className="text-left">
                      <h3 className="text-xl font-bold text-foreground">
                        {t('moreAppsCount', { count: approvedApps.length })}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {showAllApps ? t('clickToCollapse') : t('clickToViewMore')}
                      </p>
                    </div>
                  </div>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {approvedApps.map((app) => (
                    <AppShowcaseCard
                      key={app.id}
                      app={app}
                      showModerationControls={isModerator}
                      hideApprovalStatus={true}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </div>
    </div>
  );
}