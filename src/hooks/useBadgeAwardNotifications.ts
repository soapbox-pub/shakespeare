import { useEffect, useRef, useState } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import type { NostrEvent } from '@nostrify/nostrify';

const BADGE_ISSUER_PUBKEY = "804a5a94d972d2218d2cc8712881e6f00df09fe7a1a269ccbf916e5c8c17efcc";

export function useBadgeAwardNotifications() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const [newAward, setNewAward] = useState<NostrEvent | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const subscriptionStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user?.pubkey) {
      // Clear subscription if user logs out
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      return;
    }

    // Create abort controller for this subscription
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Set the subscription start time to now, so we only get new events
    const subscriptionStartTime = Math.floor(Date.now() / 1000);
    subscriptionStartTimeRef.current = subscriptionStartTime;

    // Set up subscription for new badge awards
    const setupSubscription = async () => {
      try {
        const subscription = nostr.req([{
          kinds: [8],
          authors: [BADGE_ISSUER_PUBKEY],
          "#p": [user.pubkey],
          since: subscriptionStartTime, // Only get events from now onwards
        }]);

        // Process messages from the subscription
        // Messages are in format: [type, subscriptionId, event]
        for await (const msg of subscription) {
          // Check if subscription was aborted or component unmounted
          if (abortController.signal.aborted || !isMountedRef.current) {
            break;
          }

          // Handle EVENT messages (msg[0] === 'EVENT')
          if (msg[0] === 'EVENT') {
            const event = msg[2] as NostrEvent;
            
            // Only show if component is still mounted and not aborted
            if (isMountedRef.current && !abortController.signal.aborted) {
              setNewAward(event);
            }
          }
          
          // EOSE (End of Stored Events) - subscription is complete for initial query
          // We continue listening for new events, so we don't break here
          if (msg[0] === 'EOSE') {
            // Initial query complete, now listening for new events
            continue;
          }
        }
      } catch (error) {
        // Subscription closed or error - this is normal on cleanup
        // Ignore errors if we aborted or unmounted
        if (abortController.signal.aborted || !isMountedRef.current) {
          return;
        }
        console.error('Error in badge award subscription:', error);
      }
    };

    setupSubscription();

    // Cleanup on unmount or user change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [nostr, user?.pubkey]);

  const clearNewAward = () => {
    setNewAward(null);
  };

  return {
    newAward,
    clearNewAward,
  };
}

