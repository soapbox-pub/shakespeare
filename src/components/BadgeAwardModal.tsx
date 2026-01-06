import { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Award } from "lucide-react";
import type { NostrEvent } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from "@/components/ui/skeleton";
import { BADGE_ISSUER_PUBKEY } from '@/pages/BadgesSettings';

interface BadgeAwardModalProps {
  award?: NostrEvent | null;
  badgeDefinition?: NostrEvent | null;
  onClose: () => void;
}

export function BadgeAwardModal({ award, badgeDefinition: providedBadgeDefinition, onClose }: BadgeAwardModalProps) {
  const { nostr } = useNostr();
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  // Play sound when badge is awarded (only when award is present, not just viewing badge definition)
  useEffect(() => {
    if (award && badgeDefinition && isModalOpen && !isLoading) {
      // Create audio element if it doesn't exist
      if (!audioRef.current) {
        audioRef.current = new Audio('/badgeAwarded.mp3');
        audioRef.current.volume = 0.5; // Set volume to 50%
      }
      
      // Reset to beginning and play the sound
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((error) => {
        // Silently handle autoplay restrictions
        console.debug('Audio playback failed:', error);
      });
    }
  }, [award, badgeDefinition, isModalOpen, isLoading]);

  // Return null after all hooks if we don't have a badge definition
  if (!badgeDefinition) return null;

  const nameTag = badgeDefinition?.tags?.find(([t]) => t === "name")?.[1];
  const descriptionTag = badgeDefinition?.tags?.find(([t]) => t === "description")?.[1];
  const imageTag = badgeDefinition?.tags?.find(([t]) => t === "image")?.[1];
  const thumbTags = badgeDefinition?.tags?.filter(([t]) => t === "thumb") || [];

  const badgeName = nameTag || dTag || "Unnamed Badge";
  const description = descriptionTag || "";
  const imageUrl = imageTag || (thumbTags.length > 0 ? thumbTags[thumbTags.length - 1]?.[1] : null);

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(90vw,600px)] aspect-square bg-transparent [&>button]:hidden border-0 ring-0 outline-none shadow-none flex items-center justify-center p-[min(4vw,2rem)]">
        <DialogTitle className="sr-only">
          {award ? `Badge Awarded: ${badgeName}` : badgeName}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {description || `Badge: ${badgeName}`}
        </DialogDescription>
        <div className="flex flex-col items-center justify-center space-y-[min(4vw,2rem)] w-full h-full">
          {isLoading ? (
            <>
              <Skeleton className="w-[min(60vw,384px)] aspect-square rounded-lg" />
              <div className="space-y-2 text-center w-full">
                <Skeleton className="h-[clamp(1.5rem,4vw,2rem)] w-[min(80%,16rem)] mx-auto" />
                <Skeleton className="h-[clamp(1rem,3vw,1.25rem)] w-[min(90%,20rem)] mx-auto" />
              </div>
            </>
          ) : (
            <>
              {/* Badge image */}
              <div className="relative aspect-square w-[min(60vw,384px)] before:absolute before:inset-0 before:rounded-lg before:bg-white/30 before:blur-2xl before:animate-pulse before:-z-10">
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
              <div className="text-center space-y-[min(1vw,0.75rem)] w-full px-4">
                <p className="text-[clamp(1.25rem,5vw,1.5rem)] font-semibold">{badgeName}</p>
                {description && (
                  <p className="text-[clamp(0.875rem,3vw,1rem)] text-muted-foreground max-w-md mx-auto">
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

