import React from "react";
import { useAppSubmissions } from "@/hooks/useAppSubmissions";
import { AppShowcaseCard } from "@/components/AppShowcaseCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { useAppContext } from "@/hooks/useAppContext";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Link } from 'react-router';
import { Settings } from 'lucide-react';

export function AppShowcase() {
  const { t } = useTranslation();
  const { config } = useAppContext();
  const { data: submissions = [], isLoading } = useAppSubmissions();

  // Don't show showcase if disabled in settings
  if (!config.showcaseEnabled) {
    return null;
  }

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
                <div className="mt-auto flex gap-2">
                  <Skeleton className="h-6 flex-1" />
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
              <Button asChild variant="outline" className="w-full">
                <Link to="/settings/nostr">
                  <Settings className="h-4 w-4 mr-2" />
                  {t('relayConfiguration')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-16 max-w-7xl mx-auto">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {submissions.map((app) => (
          <AppShowcaseCard key={app.id} app={app} />
        ))}
      </div>
    </div>
  );
}
