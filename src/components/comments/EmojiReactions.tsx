import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  useCommentReactions,
  useAddCommentReaction,
  EMOJI_REACTIONS,
  type CommentReaction
} from '@/hooks/useCommentReactions';
import { Smile, Plus } from 'lucide-react';

interface EmojiReactionsProps {
  commentId: string;
  commentAuthor: string;
  className?: string;
}

export function EmojiReactions({ commentId, commentAuthor, className }: EmojiReactionsProps) {
  const { user } = useCurrentUser();
  const { data: reactions = [], isLoading } = useCommentReactions(commentId);
  const { mutate: addReaction, isPending: isAddingReaction } = useAddCommentReaction();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const handleReactionToggle = (emoji: string) => {
    if (!user) return;

    addReaction({
      commentId,
      emoji,
      commentAuthor,
      isToggle: true,
    });
  };

  const handleEmojiSelect = (emoji: string) => {
    addReaction({
      commentId,
      emoji,
      commentAuthor,
      isToggle: false, // Always add when selecting from picker
    });
    setIsPopoverOpen(false);
  };

  if (isLoading) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <div className="flex gap-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-6 w-12 bg-muted animate-pulse rounded-full"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={`flex items-center gap-1 flex-wrap ${className}`}>
        {/* Existing Reactions */}
        {reactions.map((reaction) => (
          <ReactionBadge
            key={reaction.emoji}
            reaction={reaction}
            onToggle={() => handleReactionToggle(reaction.emoji)}
            disabled={isAddingReaction}
          />
        ))}

        {/* Add Reaction Button */}
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs hover:bg-muted/50"
              disabled={!user || isAddingReaction}
            >
              <Smile className="h-3 w-3 mr-1" />
              <Plus className="h-2 w-2" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-4 gap-1">
              {EMOJI_REACTIONS.map(({ emoji, label }) => (
                <Button
                  key={emoji}
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 hover:bg-muted/50"
                  onClick={() => handleEmojiSelect(emoji)}
                  title={label}
                >
                  <span className="text-lg">{emoji}</span>
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </TooltipProvider>
  );
}

interface ReactionBadgeProps {
  reaction: CommentReaction;
  onToggle: () => void;
  disabled?: boolean;
}

function ReactionBadge({ reaction, onToggle, disabled }: ReactionBadgeProps) {
  const { user } = useCurrentUser();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={reaction.userReacted ? "default" : "secondary"}
          size="sm"
          className={`h-6 px-2 text-xs gap-1 ${
            reaction.userReacted
              ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
              : 'hover:bg-muted/50'
          }`}
          onClick={onToggle}
          disabled={!user || disabled}
        >
          <span>{reaction.emoji}</span>
          <span className="text-xs">{reaction.count}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <ReactionTooltip reaction={reaction} />
      </TooltipContent>
    </Tooltip>
  );
}

function ReactionTooltip({ reaction }: { reaction: CommentReaction }) {
  const { user } = useCurrentUser();

  // Simple tooltip for now - we'll show count and emoji
  // In the future, we could create a separate component to fetch user names
  const tooltipText = user && reaction.users.includes(user.pubkey)
    ? `You and ${reaction.count - 1} other${reaction.count > 2 ? 's' : ''} reacted with ${reaction.emoji}`
    : `${reaction.count} ${reaction.count === 1 ? 'person' : 'people'} reacted with ${reaction.emoji}`;

  return <span className="text-sm">{tooltipText}</span>;
}