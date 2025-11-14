import { useNostr } from "@nostrify/react";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { useCurrentUser } from "./useCurrentUser";

import type { NostrEvent } from "@nostrify/nostrify";

export function useNostrPublish(): UseMutationResult<NostrEvent> {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (t: Omit<NostrEvent, 'id' | 'pubkey' | 'sig'>) => {
      if (user) {
        const tags = t.tags ?? [];

        // Add the client tag if it doesn't exist
        if (location.protocol === "https:" && !tags.some(([name]) => name === "client")) {
          tags.push(["client", location.hostname]);
        }

        const event = await user.signer.signEvent({
          kind: t.kind,
          content: t.content ?? "",
          tags,
          created_at: t.created_at ?? Math.floor(Date.now() / 1000),
        });

        await nostr.event(event, { signal: AbortSignal.timeout(5000) });
        return event;
      } else {
        throw new Error("User is not logged in");
      }
    },
    onError: (error) => {
      console.error("Failed to publish event:", error);
    },
    onSuccess: (data) => {
      console.log("Event published successfully:", data);

      // Invalidate relevant queries based on event kind and tags
      const kind = data.kind;
      const tags = data.tags || [];

      // Comments (kind 1111)
      if (kind === 1111) {
        // Invalidate all comment queries
        queryClient.invalidateQueries({ queryKey: ['nostr', 'comments'] });
      }

      // Ratings and Emoji Reactions (kind 7)
      if (kind === 7) {
        // Invalidate rating queries for the target event
        const eTag = tags.find(([name]) => name === 'e')?.[1];
        if (eTag) {
          queryClient.invalidateQueries({ queryKey: ['ratings', eTag] });
          // Also invalidate comment reactions if this is a reaction to a comment
          queryClient.invalidateQueries({ queryKey: ['comment-reactions', eTag] });
        }
      }

      // App submissions (kind 31733)
      if (kind === 31733) {
        queryClient.invalidateQueries({ queryKey: ['nostr', 'app-submissions'] });
        queryClient.invalidateQueries({ queryKey: ['app-submissions'] });
      }

      // Moderation lists (kind 30267)
      if (kind === 30267) {
        const dTag = tags.find(([name]) => name === 'd')?.[1];
        if (dTag?.includes('soapbox-')) {
          // Invalidate app submissions and showcase queries
          queryClient.invalidateQueries({ queryKey: ['nostr', 'app-submissions'] });
          queryClient.invalidateQueries({ queryKey: ['app-submissions'] });
          queryClient.invalidateQueries({ queryKey: ['showcase-moderation'] });
        }
      }

      // Reports (kind 1984)
      if (kind === 1984) {
        // Invalidate app submissions and moderation queries
        queryClient.invalidateQueries({ queryKey: ['nostr', 'app-submissions'] });
        queryClient.invalidateQueries({ queryKey: ['app-submissions'] });
        queryClient.invalidateQueries({ queryKey: ['showcase-moderation'] });
      }
    },
  });
}