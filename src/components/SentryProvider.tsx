import { ReactNode, useEffect } from 'react';
import { useAppContext } from '@/hooks/useAppContext';
import { initializeSentry, disableSentry, isSentryInitialized } from '@/lib/sentry';

interface SentryProviderProps {
  children: ReactNode;
}

export function SentryProvider({ children }: SentryProviderProps) {
  const { config } = useAppContext();

  useEffect(() => {
    const shouldEnableSentry = config.sentryDsn && config.sentryEnabled;

    if (shouldEnableSentry && !isSentryInitialized()) {
      // Initialize Sentry
      initializeSentry(config.sentryDsn).catch(console.error);
    } else if (!shouldEnableSentry && isSentryInitialized()) {
      // Disable Sentry
      disableSentry().catch(console.error);
    }
  }, [config.sentryDsn, config.sentryEnabled]);

  return <>{children}</>;
}
