import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmojiReactions } from '@/components/comments/EmojiReactions';
import { EMOJI_REACTIONS } from '@/hooks/useCommentReactions';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { LoginArea } from '@/components/auth/LoginArea';
import { Smile, Heart, Zap } from 'lucide-react';

/**
 * Demo component showing emoji reactions functionality
 * This demonstrates how users can react to comments with emojis
 */
export function EmojiReactionsDemo() {
  const { user } = useCurrentUser();

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smile className="h-5 w-5" />
            Emoji Reactions Demo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            This demo shows how emoji reactions work on comments.
            Please log in to test the functionality.
          </p>
          <LoginArea />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smile className="h-5 w-5" />
          Emoji Reactions Demo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Try out emoji reactions on this demo comment. Click existing reactions to toggle them, or add new ones!
          </p>
          
          <div className="bg-muted/50 p-4 rounded-lg space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                <span className="text-sm">👤</span>
              </div>
              <div>
                <p className="font-medium text-sm">Demo User</p>
                <p className="text-xs text-muted-foreground">2 minutes ago</p>
              </div>
            </div>
            
            <p className="text-sm">
              This is a demo comment to showcase emoji reactions! 
              Try clicking the reactions below or adding your own.
            </p>
            
            {/* Demo Emoji Reactions */}
            <EmojiReactions 
              commentId="demo-comment-123"
              commentAuthor="demo-author-pubkey"
            />
          </div>
        </div>

        <div className="border-t pt-6">
          <h4 className="font-medium mb-4 flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Available Reactions
          </h4>
          <div className="grid grid-cols-4 gap-3">
            {EMOJI_REACTIONS.map(({ emoji, label }) => (
              <div key={emoji} className="flex flex-col items-center gap-1">
                <div className="text-2xl">{emoji}</div>
                <Badge variant="outline" className="text-xs">
                  {label}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-muted/50 p-4 rounded-lg">
          <h5 className="font-medium text-sm mb-2 flex items-center gap-2">
            <Zap className="h-4 w-4" />
            How it works:
          </h5>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>Click existing reactions</strong> to toggle your reaction on/off</li>
            <li>• <strong>Use the smile button</strong> to add new emoji reactions</li>
            <li>• <strong>Hover over reactions</strong> to see who reacted</li>
            <li>• <strong>Real-time updates</strong> show reactions instantly</li>
            <li>• <strong>Optimistic UI</strong> makes interactions feel immediate</li>
          </ul>
        </div>

        <div className="text-xs text-muted-foreground">
          💡 Tip: Emoji reactions use Nostr kind 7 events and support real-time synchronization across all clients.
        </div>
      </CardContent>
    </Card>
  );
}