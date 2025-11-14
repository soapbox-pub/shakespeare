import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { LoginArea } from '@/components/auth/LoginArea';
import { RefreshCw, MessageSquare, Star, Heart } from 'lucide-react';

/**
 * Demo component showing real-time updates for showcase ratings and comments
 * This demonstrates the optimistic updates and automatic cache invalidation
 */
export function RealTimeDemo() {
  const { user } = useCurrentUser();
  const { mutate: publishEvent, isPending } = useNostrPublish();
  const { toast } = useToast();
  const [demoCounter, setDemoCounter] = useState(0);

  const handleDemoAction = (actionType: 'comment' | 'rating' | 'moderation') => {
    if (!user) {
      toast({
        title: 'Login Required',
        description: 'Please log in to test real-time updates',
        variant: 'destructive',
      });
      return;
    }

    setDemoCounter(prev => prev + 1);

    switch (actionType) {
      case 'comment': {
        // Simulate posting a comment (kind 1111)
        publishEvent({
          kind: 1111,
          content: `Demo comment #${demoCounter + 1} - This demonstrates real-time comment updates!`,
          tags: [
            ['E', 'demo-event-id'],
            ['K', '1'],
            ['P', 'demo-author-pubkey'],
          ],
        });
        break;
      }

      case 'rating': {
        // Simulate posting a rating (kind 7)
        const rating = Math.floor(Math.random() * 5) + 1;
        publishEvent({
          kind: 7,
          content: rating.toString(),
          tags: [
            ['e', 'demo-app-event-id'],
            ['p', 'demo-app-author-pubkey'],
          ],
        });
        break;
      }

      case 'moderation': {
        // Simulate moderation action (kind 30267 list update)
        publishEvent({
          kind: 30267,
          content: 'Demo moderation list update',
          tags: [
            ['d', 'demo-featured-apps'],
            ['title', 'Demo Featured Apps'],
            ['a', `31733:demo-pubkey:demo-app-${demoCounter + 1}`],
          ],
        });
        break;
      }
    }

    toast({
      title: 'Demo Action Triggered!',
      description: `${actionType} action will update in real-time across all components`,
    });
  };

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Real-Time Updates Demo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            This demo shows how ratings and comments update in real-time without page refreshes.
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
          <RefreshCw className="h-5 w-5" />
          Real-Time Updates Demo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Test real-time updates by triggering demo actions. These will demonstrate:
          </p>

          <div className="grid gap-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline">
                <MessageSquare className="h-3 w-3 mr-1" />
                Comments
              </Badge>
              <span className="text-sm">Optimistic updates + automatic refresh</span>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="outline">
                <Star className="h-3 w-3 mr-1" />
                Ratings
              </Badge>
              <span className="text-sm">Instant UI updates + cache invalidation</span>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="outline">
                <Heart className="h-3 w-3 mr-1" />
                Moderation
              </Badge>
              <span className="text-sm">Real-time status changes</span>
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <h4 className="font-medium mb-4">Test Actions</h4>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => handleDemoAction('comment')}
              disabled={isPending}
              variant="outline"
              size="sm"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Demo Comment
            </Button>

            <Button
              onClick={() => handleDemoAction('rating')}
              disabled={isPending}
              variant="outline"
              size="sm"
            >
              <Star className="h-4 w-4 mr-2" />
              Demo Rating
            </Button>

            <Button
              onClick={() => handleDemoAction('moderation')}
              disabled={isPending}
              variant="outline"
              size="sm"
            >
              <Heart className="h-4 w-4 mr-2" />
              Demo Moderation
            </Button>
          </div>
        </div>

        <div className="bg-muted/50 p-4 rounded-lg">
          <h5 className="font-medium text-sm mb-2">How it works:</h5>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>Optimistic Updates:</strong> UI updates immediately before server confirmation</li>
            <li>• <strong>Cache Invalidation:</strong> Related queries refresh automatically after publishing</li>
            <li>• <strong>Error Handling:</strong> Failed actions revert optimistic changes</li>
            <li>• <strong>Real-time Sync:</strong> Background polling keeps data fresh (10-30s intervals)</li>
          </ul>
        </div>

        <div className="text-xs text-muted-foreground">
          Demo counter: {demoCounter} actions triggered
        </div>
      </CardContent>
    </Card>
  );
}