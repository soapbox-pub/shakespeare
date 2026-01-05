import { Award, Lock } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { SettingsPageLayout } from '@/components/SettingsPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useNostr } from '@nostrify/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAISettings } from '@/hooks/useAISettings';
import { useAppContext } from '@/hooks/useAppContext';
import { BadgeAwardModal } from '@/components/BadgeAwardModal';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import type { NostrEvent } from '@nostrify/nostrify';
import { createAIClient } from '@/lib/ai-client';
import { nip19 } from 'nostr-tools';

const BADGE_ISSUER_NPUB = "npub1e0u5dfurw3dmd0n5lul873c5g3p89et6x372sa35spajcxjh4f6svcvahk";
const BADGE_ISSUER_PUBKEY = nip19.decode(BADGE_ISSUER_NPUB).data as string;

// Badge sync response from the server
interface BadgeSyncResponse {
  object: 'badge_sync';
  synced: string[];
  stats: {
    total_tokens: number;
    image_count: number;
    has_lightning_payment: boolean;
    giftcards_sent: number;
    max_giftcard_amount: number;
  };
}

// Milestones for progress tracking
const TOKEN_MILESTONES = [100_000, 1_000_000, 1_000_000_000, 10_000_000_000];
const IMAGE_MILESTONES = [1, 10, 100, 1_000];

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

function getNextMilestone(current: number, milestones: number[]): number | null {
  for (const milestone of milestones) {
    if (current < milestone) return milestone;
  }
  return null;
}

function getMilestoneProgress(current: number, milestones: number[]): { progress: number; current: number; next: number | null } {
  const next = getNextMilestone(current, milestones);
  if (!next) {
    // All milestones achieved
    return { progress: 100, current, next: null };
  }
  
  // Find the previous milestone (or 0 if none)
  const prevMilestone = milestones.filter(m => m <= current).pop() ?? 0;
  const range = next - prevMilestone;
  const progressInRange = current - prevMilestone;
  const progress = Math.min(100, (progressInRange / range) * 100);
  
  return { progress, current, next };
}

function BadgeCard({ 
  event, 
  awarded, 
  unlockDate,
  onClick 
}: { 
  event: NostrEvent; 
  awarded: boolean;
  unlockDate?: number | null;
  onClick?: () => void;
}) {
  const dTag = event.tags.find(([t]) => t === "d")?.[1];
  const nameTag = event.tags.find(([t]) => t === "name")?.[1];
  const descriptionTag = event.tags.find(([t]) => t === "description")?.[1];
  const imageTag = event.tags.find(([t]) => t === "image")?.[1];
  const thumbTags = event.tags.filter(([t]) => t === "thumb");

  const badgeName = nameTag || dTag || "Unnamed Badge";
  const description = descriptionTag || "";
  const imageUrl = imageTag || (thumbTags.length > 0 ? thumbTags[thumbTags.length - 1]?.[1] : null);

  const formattedDate = unlockDate 
    ? new Date(unlockDate * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
    : null;

  return (
    <Card 
      className={cn(
        "transition-all bg-transparent border-none shadow-none h-full",
        awarded ? "cursor-pointer hover:scale-105" : ""
      )}
      onClick={awarded ? onClick : undefined}
    >
      <CardHeader className="text-center p-0 h-full flex flex-col">
        <div className="flex justify-center">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={badgeName}
              className={cn(
                "w-32 h-32 rounded-lg object-cover",
                awarded ? "" : "opacity-50 grayscale blur-md"
              )}
            />
          ) : null}
        </div>
        <div className="flex flex-col flex-1 mt-4">
          {/* Title area - fixed height for 2 lines */}
          <div className="min-h-[3.5rem] flex items-start justify-center">
            {awarded ? (
              <CardTitle className="text-lg leading-tight line-clamp-2">
                {badgeName}
              </CardTitle>
            ) : (
              <Lock className="h-5 w-5 text-muted-foreground mt-1" />
            )}
          </div>
          {/* Description area - fixed height for 2 lines */}
          {description && (
            <p className={cn(
              "text-sm min-h-[2.5rem] line-clamp-2 mt-1",
              awarded ? "text-muted-foreground" : "text-muted-foreground/70"
            )}>
              {description}
            </p>
          )}
          {/* Unlock date - pushed to bottom */}
          <div className="mt-auto pt-2">
            {awarded && formattedDate && (
              <p className="text-xs text-muted-foreground/70">
                Unlocked {formattedDate}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

export function BadgesSettings() {
  const { t } = useTranslation();
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { settings } = useAISettings();
  const { config } = useAppContext();
  const queryClient = useQueryClient();
  const userPubkey = user?.pubkey;
  const [selectedBadge, setSelectedBadge] = useState<NostrEvent | null>(null);
  const [progressIndex, setProgressIndex] = useState(0);

  // Find a Shakespeare provider (one with nostr auth) for badge sync
  const shakespeareProvider = useMemo(
    () => settings.providers.find(p => p.nostr),
    [settings.providers]
  );

  // Badge sync query - calls the server to sync badges and get stats
  const { data: syncData } = useQuery({
    queryKey: ['badge-sync', userPubkey, shakespeareProvider?.id],
    queryFn: async (): Promise<BadgeSyncResponse> => {
      if (!shakespeareProvider || !user) {
        throw new Error('No provider or user available');
      }
      const ai = createAIClient(shakespeareProvider, user, config.corsProxy);
      const response = await ai.post('/badges/sync', {}) as BadgeSyncResponse;
      
      // If any badges were synced, invalidate the badge awards query
      if (response.synced.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['badge-awards', BADGE_ISSUER_PUBKEY, userPubkey] });
      }
      
      return response;
    },
    enabled: !!user && !!shakespeareProvider,
    staleTime: 0, // Always refetch on mount for fresh progress
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 min
    retry: 1,
  });

  // Get stats from sync response
  const stats = syncData?.stats;
  const tokenProgress = stats ? getMilestoneProgress(stats.total_tokens, TOKEN_MILESTONES) : null;
  const imageProgress = stats ? getMilestoneProgress(stats.image_count, IMAGE_MILESTONES) : null;

  const { data: badgeDefinitions, isLoading: isLoadingDefinitions } = useQuery({
    queryKey: ['badge-definitions', BADGE_ISSUER_PUBKEY],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query([{
        kinds: [30009],
        authors: [BADGE_ISSUER_PUBKEY],
        limit: 100,
      }], { signal });
      return events;
    },
  });

  // Query for badge awards if user is logged in
  const { data: badgeAwards, isLoading: isLoadingAwards } = useQuery({
    queryKey: ['badge-awards', BADGE_ISSUER_PUBKEY, userPubkey],
    queryFn: async (c) => {
      if (!userPubkey) return [];
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query([{
        kinds: [8],
        authors: [BADGE_ISSUER_PUBKEY],
        "#p": [userPubkey],
        limit: 100,
      }], { signal });
      return events;
    },
    enabled: !!userPubkey,
  });

  // Create a map of awarded badges (a-tag -> first award date)
  const awardedBadges = new Map<string, number>();
  if (badgeAwards) {
    for (const award of badgeAwards) {
      const aTag = award.tags.find(([t]) => t === "a")?.[1];
      if (aTag) {
        // Store the earliest award date for this badge
        const existingDate = awardedBadges.get(aTag);
        if (!existingDate || award.created_at < existingDate) {
          awardedBadges.set(aTag, award.created_at);
        }
      }
    }
  }

  // Helper to check if a badge is awarded
  const isBadgeAwarded = (badgeDefinition: NostrEvent): boolean => {
    if (!userPubkey) return false;
    const dTag = badgeDefinition.tags.find(([t]) => t === "d")?.[1];
    if (!dTag) return false;
    const aTag = `30009:${BADGE_ISSUER_PUBKEY}:${dTag}`;
    return awardedBadges.has(aTag);
  };

  // Helper to get first award date for a badge
  const getFirstAwardDate = (badgeDefinition: NostrEvent): number | null => {
    if (!userPubkey) return null;
    const dTag = badgeDefinition.tags.find(([t]) => t === "d")?.[1];
    if (!dTag) return null;
    const aTag = `30009:${BADGE_ISSUER_PUBKEY}:${dTag}`;
    return awardedBadges.get(aTag) || null;
  };

  // Sort badges: unlocked by first award date (earliest first), then locked badges
  const sortedBadgeDefinitions = badgeDefinitions ? [...badgeDefinitions].sort((a, b) => {
    const aAwarded = isBadgeAwarded(a);
    const bAwarded = isBadgeAwarded(b);

    // If both are awarded, sort by first award date (earliest first)
    if (aAwarded && bAwarded) {
      const aDate = getFirstAwardDate(a) || 0;
      const bDate = getFirstAwardDate(b) || 0;
      return aDate - bDate;
    }

    // If only one is awarded, awarded comes first
    if (aAwarded && !bAwarded) return -1;
    if (!aAwarded && bAwarded) return 1;

    // Both are locked, maintain original order
    return 0;
  }) : [];

  const isLoading = isLoadingDefinitions || (userPubkey && isLoadingAwards);

  // Calculate badge counts
  const totalBadges = sortedBadgeDefinitions.length;
  const unlockedBadges = sortedBadgeDefinitions.filter(badge => isBadgeAwarded(badge)).length;
  const progressPercentage = totalBadges > 0 ? (unlockedBadges / totalBadges) * 100 : 0;

  return (
    <SettingsPageLayout
      icon={Award}
      titleKey="badges"
      descriptionKey="badgesDescription"
      titleSuffix={
        !isLoading && totalBadges > 0 ? (
          <div className="flex flex-wrap items-center gap-3 ml-3">
            <Card className="bg-muted/50 border">
              <CardContent className="py-1.5 px-4">
                <p className="text-sm font-medium">
                  <span className="text-foreground">{unlockedBadges}</span>
                  <span className="text-muted-foreground"> / </span>
                  <span className="text-foreground">{totalBadges}</span>
                  <span className="text-muted-foreground"> unlocked</span>
                </p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50 border">
              <CardContent className="py-1.5 px-4">
                <div className="flex items-center gap-2">
                  <Progress value={progressPercentage} className="h-1.5 w-24" />
                  <span className="text-sm font-medium">{Math.round(progressPercentage)}%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : undefined
      }
    >
      <BadgeAwardModal 
        badgeDefinition={selectedBadge} 
        onClose={() => setSelectedBadge(null)} 
      />

      {/* Progress Tracking Section */}
      {stats && (() => {
        const progressItems = [
          tokenProgress?.next && { type: 'token', progress: tokenProgress },
          imageProgress?.next && { type: 'image', progress: imageProgress },
        ].filter(Boolean) as Array<{ type: 'token' | 'image'; progress: { progress: number; current: number; next: number } }>;

        if (progressItems.length === 0) return null;

        const currentIndex = progressIndex % progressItems.length;
        const current = progressItems[currentIndex];

        return (
          <Card 
            className="mb-6 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setProgressIndex(prev => prev + 1)}
          >
            <CardContent className="py-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">
                    {current.type === 'token' ? t('tokenProgress') : t('imageProgress')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {current.type === 'token' 
                      ? `${formatNumber(current.progress.current)} / ${formatNumber(current.progress.next)}`
                      : `${current.progress.current} / ${current.progress.next}`
                    }
                  </span>
                </div>
                <Progress value={current.progress.progress} className="h-2" />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">
                    {t('nextBadgeAt', { milestone: formatNumber(current.progress.next) })}
                  </p>
                  {progressItems.length > 1 && (
                    <div className="flex gap-1">
                      {progressItems.map((_, i) => (
                        <div 
                          key={i}
                          className={cn(
                            "w-1.5 h-1.5 rounded-full transition-colors",
                            i === currentIndex ? "bg-primary" : "bg-muted-foreground/30"
                          )}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <div className="space-y-4">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="text-center space-y-4">
                  <div className="flex justify-center">
                    <Skeleton className="w-32 h-32 rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32 mx-auto" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4 mx-auto" />
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : sortedBadgeDefinitions && sortedBadgeDefinitions.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedBadgeDefinitions.map((event) => (
              <BadgeCard 
                key={event.id} 
                event={event} 
                awarded={isBadgeAwarded(event)}
                unlockDate={getFirstAwardDate(event)}
                onClick={isBadgeAwarded(event) ? () => setSelectedBadge(event) : undefined}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 px-8 text-center">
              <div className="max-w-sm mx-auto space-y-4">
                <Award className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">
                  {t('noBadgesFound')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SettingsPageLayout>
  );
}

export default BadgesSettings;

