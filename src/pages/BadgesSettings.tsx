import { Award } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { SettingsPageLayout } from '@/components/SettingsPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/utils';
import type { NostrEvent } from '@nostrify/nostrify';

const BADGE_ISSUER_PUBKEY = "804a5a94d972d2218d2cc8712881e6f00df09fe7a1a269ccbf916e5c8c17efcc";

function BadgeCard({ event, awarded }: { event: NostrEvent; awarded: boolean }) {
  const dTag = event.tags.find(([t]) => t === "d")?.[1];
  const nameTag = event.tags.find(([t]) => t === "name")?.[1];
  const descriptionTag = event.tags.find(([t]) => t === "description")?.[1];
  const imageTag = event.tags.find(([t]) => t === "image")?.[1];
  const thumbTags = event.tags.filter(([t]) => t === "thumb");

  const badgeName = nameTag || dTag || "Unnamed Badge";
  const description = descriptionTag || "";
  const imageUrl = imageTag || (thumbTags.length > 0 ? thumbTags[thumbTags.length - 1]?.[1] : null);

  return (
    <Card className={cn(
      "transition-all bg-transparent border-none shadow-none",
      awarded ? "" : "opacity-50 grayscale"
    )}>
      <CardHeader className="text-center space-y-4 p-0">
        {imageUrl && (
          <div className="flex justify-center">
            <img
              src={imageUrl}
              alt={badgeName}
              className="w-32 h-32 rounded-lg object-cover"
            />
          </div>
        )}
        <div className="space-y-2">
          <CardTitle className={cn("text-lg", awarded ? "" : "text-muted-foreground")}>
            {badgeName}
          </CardTitle>
          {description && (
            <p className={cn("text-sm", awarded ? "text-muted-foreground" : "text-muted-foreground/70")}>
              {description}
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

  // Create a map of awarded badges (a-tag -> true)
  const awardedBadges = new Set<string>();
  if (badgeAwards) {
    for (const award of badgeAwards) {
      const aTag = award.tags.find(([t]) => t === "a")?.[1];
      if (aTag) {
        awardedBadges.add(aTag);
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

  const isLoading = isLoadingDefinitions || (userPubkey && isLoadingAwards);

  return (
    <SettingsPageLayout
      icon={Award}
      titleKey="badges"
      descriptionKey="badgesDescription"
    >
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
        ) : badgeDefinitions && badgeDefinitions.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {badgeDefinitions.map((event) => (
              <BadgeCard 
                key={event.id} 
                event={event} 
                awarded={isBadgeAwarded(event)}
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

