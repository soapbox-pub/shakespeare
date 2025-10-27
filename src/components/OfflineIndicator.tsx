import { WifiOff, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { useOffline } from '@/hooks/useOffline';

/**
 * Component that displays an indicator when the app is offline
 */
export function OfflineIndicator() {
  const { isOffline, isOnline } = useOffline();
  const [showOnlineNotification, setShowOnlineNotification] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (isOffline) {
      setWasOffline(true);
    }

    if (isOnline && wasOffline) {
      // Show "back online" notification briefly
      setShowOnlineNotification(true);
      const timer = setTimeout(() => {
        setShowOnlineNotification(false);
        setWasOffline(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isOffline, isOnline, wasOffline]);

  if (!isOffline && !showOnlineNotification) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-4">
      {isOffline ? (
        <Alert variant="destructive" className="shadow-lg border-2">
          <WifiOff className="h-4 w-4" />
          <AlertDescription className="font-medium">
            You're offline. Some features may be limited.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="shadow-lg border-2 border-green-500 bg-green-50 dark:bg-green-950">
          <Wifi className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="font-medium text-green-600 dark:text-green-400">
            You're back online!
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
