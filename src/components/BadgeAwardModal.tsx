import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Award } from "lucide-react";
import type { NostrEvent } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from '@/lib/utils';

const BADGE_ISSUER_PUBKEY = "804a5a94d972d2218d2cc8712881e6f00df09fe7a1a269ccbf916e5c8c17efcc";

interface BadgeAwardModalProps {
  award?: NostrEvent | null;
  badgeDefinition?: NostrEvent | null;
  onClose: () => void;
}

export function BadgeAwardModal({ award, badgeDefinition: providedBadgeDefinition, onClose }: BadgeAwardModalProps) {
  const { nostr } = useNostr();

  // If we have a badge definition directly, use it
  // Otherwise, extract from award event
  let dTag: string | undefined;
  
  if (providedBadgeDefinition) {
    dTag = providedBadgeDefinition.tags.find(([t]) => t === "d")?.[1];
  } else if (award) {
    const aTag = award.tags.find(([t]) => t === "a")?.[1];
    if (aTag) {
      const [kindStr, pubkey, parsedDTag] = aTag.split(':');
      if (kindStr === '30009' && pubkey === BADGE_ISSUER_PUBKEY && parsedDTag) {
        dTag = parsedDTag;
      }
    }
  }

  if (!dTag && !providedBadgeDefinition) return null;

  // Fetch badge definition if we don't have it directly
  const { data: fetchedBadgeDefinition, isLoading } = useQuery({
    queryKey: ['badge-definition', BADGE_ISSUER_PUBKEY, dTag],
    queryFn: async (c) => {
      if (!dTag) return null;
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query([{
        kinds: [30009],
        authors: [BADGE_ISSUER_PUBKEY],
        "#d": [dTag],
        limit: 1,
      }], { signal });
      return events[0] || null;
    },
    enabled: !!dTag && !providedBadgeDefinition,
  });

  const badgeDefinition = providedBadgeDefinition || fetchedBadgeDefinition;
  const isModalOpen = !!award || !!providedBadgeDefinition;

  const nameTag = badgeDefinition?.tags?.find(([t]) => t === "name")?.[1];
  const descriptionTag = badgeDefinition?.tags?.find(([t]) => t === "description")?.[1];
  const imageTag = badgeDefinition?.tags?.find(([t]) => t === "image")?.[1];
  const thumbTags = badgeDefinition?.tags?.filter(([t]) => t === "thumb") || [];

  const badgeName = nameTag || dTag || "Unnamed Badge";
  const description = descriptionTag || "";
  const imageUrl = imageTag || (thumbTags.length > 0 ? thumbTags[thumbTags.length - 1]?.[1] : null);

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[600px] h-[600px] aspect-square bg-transparent [&>button]:hidden border-0 ring-0 outline-none shadow-none flex items-center justify-center p-0">
        <div className="flex flex-col items-center justify-center space-y-8 w-full h-full px-8">
          {isLoading ? (
            <>
              <Skeleton className="h-96 w-96 rounded-lg" />
              <div className="space-y-2 text-center">
                <Skeleton className="h-8 w-64 mx-auto" />
                <Skeleton className="h-5 w-80 mx-auto" />
              </div>
            </>
          ) : (
            <>
              {/* Badge image */}
              <div className="relative aspect-square w-96 before:absolute before:inset-0 before:rounded-lg before:bg-white/30 before:blur-2xl before:animate-pulse before:-z-10">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={badgeName}
                    className="h-full w-full rounded-lg object-cover shadow-2xl"
                  />
                ) : (
                  <Award className="h-full w-full text-primary drop-shadow-lg" />
                )}
              </div>

              {/* Title */}
              <div className="text-center space-y-3">
                {award && <h2 className="text-3xl font-bold">Badge Awarded!</h2>}
                <p className="text-2xl font-semibold">{badgeName}</p>
                {description && (
                  <p className="text-base text-muted-foreground max-w-md">
                    {description}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

