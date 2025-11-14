import { useNostr } from '@nostrify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import type { NostrEvent } from '@nostrify/nostrify';

// Predefined emoji reactions
export const EMOJI_REACTIONS = [
  { emoji: '👍', label: 'thumbs up' },
  { emoji: '❤️', label: 'heart' },
  { emoji: '😂', label: 'laugh' },
  { emoji: '😮', label: 'wow' },
  { emoji: '😢', label: 'sad' },
  { emoji: '😡', label: 'angry' },
  { emoji: '🎉', label: 'celebrate' },
  { emoji: '🔥', label: 'fire' },
] as const;

export type EmojiReaction = typeof EMOJI_REACTIONS[number];

export interface CommentReaction {
  emoji: string;
  count: number;
  userReacted: boolean;
  users: string[]; // pubkeys of users who reacted
}

export interface CommentReactions {
  [emoji: string]: CommentReaction;
}

export function useCommentReactions(commentId: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['comment-reactions', commentId],
    queryFn: async () => {
      // Fetch kind 7 reactions that reference this comment
      const reactions = await nostr.query(
        [
          {
            kinds: [7],
            '#e': [commentId],
            limit: 500,
          },
        ],
        { signal: AbortSignal.timeout(3000) }
      );

      // Group reactions by emoji and user, keeping only the latest reaction from each user
      const userReactions = new Map<string, Map<string, NostrEvent>>();

      for (const reaction of reactions) {
        let emoji = reaction.content;
        const isRemoval = emoji.startsWith('-');

        if (isRemoval) {
          emoji = emoji.slice(1); // Remove the "-" prefix
        }

        if (!emoji || emoji.length > 10) continue; // Skip invalid emojis

        if (!userReactions.has(emoji)) {
          userReactions.set(emoji, new Map());
        }

        const emojiReactions = userReactions.get(emoji)!;
        const existingReaction = emojiReactions.get(reaction.pubkey);

        // Keep only the latest reaction from each user
        if (!existingReaction || reaction.created_at > existingReaction.created_at) {
          emojiReactions.set(reaction.pubkey, reaction);
        }
      }

      // Build the final reaction map
      const reactionMap: { [emoji: string]: CommentReaction } = {};

      for (const [emoji, userReactionMap] of userReactions) {
        const activeUsers: string[] = [];
        let userReacted = false;

        for (const [pubkey, reaction] of userReactionMap) {
          const isRemoval = reaction.content.startsWith('-');

          if (!isRemoval) {
            activeUsers.push(pubkey);
            if (user && pubkey === user.pubkey) {
              userReacted = true;
            }
          }
        }

        if (activeUsers.length > 0) {
          reactionMap[emoji] = {
            emoji,
            count: activeUsers.length,
            userReacted,
            users: activeUsers,
          };
        }
      }

      // Sort by count (most popular first)
      const sortedReactions = Object.values(reactionMap)
        .filter(reaction => reaction.count > 0)
        .sort((a, b) => b.count - a.count);

      return sortedReactions;
    },
    enabled: !!commentId,
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // 30 seconds
  });
}

export function useAddCommentReaction() {
  const { user } = useCurrentUser();
  const { mutate: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, emoji, commentAuthor, isToggle = false }: {
      commentId: string;
      emoji: string;
      commentAuthor: string;
      isToggle?: boolean;
    }) => {
      if (!user) {
        throw new Error('User must be logged in to react');
      }

      // Get current reactions to determine if this is an add or remove
      const currentReactions = queryClient.getQueryData(['comment-reactions', commentId]) as CommentReaction[] | undefined;
      const existingReaction = currentReactions?.find(r => r.emoji === emoji && r.userReacted);

      const content = (isToggle && existingReaction) ? `-${emoji}` : emoji;

      // Publish kind 7 reaction event
      return new Promise<NostrEvent>((resolve, reject) => {
        publishEvent({
          kind: 7,
          content,
          tags: [
            ['e', commentId],
            ['p', commentAuthor],
          ],
          created_at: Math.floor(Date.now() / 1000),
        }, {
          onSuccess: (event) => resolve(event),
          onError: (error) => reject(error),
        });
      });
    },
    onMutate: async ({ commentId, emoji, isToggle = false }) => {
      if (!user) return;

      const queryKey = ['comment-reactions', commentId];

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousReactions = queryClient.getQueryData(queryKey);

      // Optimistically update the cache
      queryClient.setQueryData(queryKey, (old: CommentReaction[] = []) => {
        const newReactions = [...old];

        // Find existing reaction for this emoji
        const existingReactionIndex = newReactions.findIndex(r => r.emoji === emoji);

        if (existingReactionIndex >= 0) {
          // Update existing reaction
          const existingReaction = newReactions[existingReactionIndex];

          if (isToggle && existingReaction.userReacted) {
            // User is removing their reaction
            newReactions[existingReactionIndex] = {
              ...existingReaction,
              count: Math.max(0, existingReaction.count - 1),
              userReacted: false,
              users: existingReaction.users.filter(pubkey => pubkey !== user.pubkey),
            };

            // Remove reaction if count reaches 0
            if (newReactions[existingReactionIndex].count === 0) {
              newReactions.splice(existingReactionIndex, 1);
            }
          } else if (!existingReaction.userReacted) {
            // User is adding their reaction
            newReactions[existingReactionIndex] = {
              ...existingReaction,
              count: existingReaction.count + 1,
              userReacted: true,
              users: [...existingReaction.users, user.pubkey],
            };
          }
        } else {
          // Add new reaction
          newReactions.push({
            emoji,
            count: 1,
            userReacted: true,
            users: [user.pubkey],
          });
        }

        // Sort by count (most popular first)
        return newReactions
          .filter(reaction => reaction.count > 0)
          .sort((a, b) => b.count - a.count);
      });

      return { previousReactions };
    },
    onError: (err, { commentId }, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      const queryKey = ['comment-reactions', commentId];
      queryClient.setQueryData(queryKey, context?.previousReactions);
    },
    onSuccess: (_, { commentId }) => {
      // Invalidate and refetch to get the real data
      queryClient.invalidateQueries({
        queryKey: ['comment-reactions', commentId]
      });
    },
  });
}

