import type * as SentryTypes from '@sentry/react';

let sentryInstance: typeof SentryTypes | null = null;
let isInitialized = false;
let isEnabled = false;

/**
 * Dynamically imports and initializes Sentry
 * @param dsn - Sentry DSN
 * @returns Promise that resolves when Sentry is initialized
 */
export async function initializeSentry(dsn: string): Promise<void> {
  // Don't initialize if DSN is empty
  if (!dsn) {
    console.log('Sentry DSN is empty, skipping initialization');
    return;
  }

  // If Sentry was already initialized once, just re-enable it
  if (isInitialized && sentryInstance) {
    console.log('Sentry already initialized, re-enabling');
    const client = sentryInstance.getClient();
    if (client) {
      client.getOptions().enabled = true;
    }
    isEnabled = true;
    return;
  }

  try {
    // Dynamic import to avoid loading Sentry unless needed
    const Sentry = await import('@sentry/react');
    sentryInstance = Sentry;

    // Initialize Sentry
    Sentry.init({
      dsn,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      // Performance Monitoring
      tracesSampleRate: 0.1, // Capture 10% of transactions for performance monitoring
      // Session Replay
      replaysSessionSampleRate: 0.1, // Sample 10% of sessions
      replaysOnErrorSampleRate: 1.0, // Sample 100% of sessions with errors
      // Environment
      environment: import.meta.env.MODE,
      // Release
      release: import.meta.env.VITE_APP_VERSION || 'development',
    });

    isInitialized = true;
    isEnabled = true;
    console.log('Sentry initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
    throw error;
  }
}

/**
 * Disables Sentry by setting enabled to false
 */
export async function disableSentry(): Promise<void> {
  if (!isInitialized || !sentryInstance || !isEnabled) {
    return;
  }

  try {
    const client = sentryInstance.getClient();
    if (client) {
      // Just disable the client instead of closing it
      // This allows re-enabling without re-initializing
      client.getOptions().enabled = false;
    }
    isEnabled = false;
    console.log('Sentry disabled successfully');
  } catch (error) {
    console.error('Failed to disable Sentry:', error);
  }
}

/**
 * Checks if Sentry is currently initialized and enabled
 */
export function isSentryInitialized(): boolean {
  return isInitialized && isEnabled;
}

/**
 * Gets the Sentry instance (if initialized)
 */
export function getSentryInstance(): typeof SentryTypes | null {
  return sentryInstance;
}
