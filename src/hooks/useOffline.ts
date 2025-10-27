import { useEffect, useState } from 'react';

/**
 * Hook to detect offline status and provide cache management utilities
 */
export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [serviceWorkerRegistration, setServiceWorkerRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Get service worker registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        setServiceWorkerRegistration(registration);
      }).catch((error) => {
        console.error('[ServiceWorker] Failed to get registration:', error);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const clearCache = async () => {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => name.startsWith('workbox-') || name.includes('shakespeare'))
          .map(name => caches.delete(name))
      );
      console.log('[Cache] Cleared all caches');
    }
  };

  const updateServiceWorker = async () => {
    if (serviceWorkerRegistration) {
      await serviceWorkerRegistration.update();
    }
  };

  return {
    isOnline,
    isOffline: !isOnline,
    serviceWorkerRegistration,
    clearCache,
    updateServiceWorker,
  };
}
