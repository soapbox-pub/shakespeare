import { Award, Lock } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { SettingsPageLayout } from '@/components/SettingsPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { BadgeAwardModal } from '@/components/BadgeAwardModal';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { NostrEvent } from '@nostrify/nostrify';

const BADGE_ISSUER_PUBKEY = "804a5a94d972d2218d2cc8712881e6f00df09fe7a1a269ccbf916e5c8c17efcc";

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
        "transition-all bg-transparent border-none shadow-none",
        awarded ? "cursor-pointer hover:scale-105" : ""
      )}
      onClick={awarded ? onClick : undefined}
    >
      <CardHeader className="text-center space-y-4 p-0">
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
        <div className="space-y-2">
          <div className="h-7 flex items-center justify-center">
            {awarded ? (
              <CardTitle className="text-lg">
                {badgeName}
              </CardTitle>
            ) : (
              <Lock className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          {description && (
            <p className={cn("text-sm", awarded ? "text-muted-foreground" : "text-muted-foreground/70")}>
              {description}
            </p>
          )}
          {awarded && formattedDate && (
            <p className="text-xs text-muted-foreground/70 mt-1">
              Unlocked {formattedDate}
            </p>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}

export function BadgesSettings() {
  const { t } = useTranslation();
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const userPubkey = user?.pubkey;
  const [selectedBadge, setSelectedBadge] = useState<NostrEvent | null>(null);

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

