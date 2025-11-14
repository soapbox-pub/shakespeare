import { ReactNode, useEffect, useRef } from 'react';
import { SessionManagerContext } from '@/contexts/SessionManagerContext';
import { SessionManager } from '@/lib/SessionManager';
import { useFS } from '@/hooks/useFS';
import { useAISettings } from '@/hooks/useAISettings';
import { useProviderModels } from '@/hooks/useProviderModels';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAppContext } from '@/hooks/useAppContext';
import { useNostr } from '@nostrify/react';

interface SessionManagerProviderProps {
  children: ReactNode;
}

/**
 * Provider that creates and manages the global session manager instance
 */
export function SessionManagerProvider({ children }: SessionManagerProviderProps) {
  const { fs } = useFS();
  const { settings } = useAISettings();
  const { models } = useProviderModels();
  const { user, metadata } = useCurrentUser();
  const { config, defaultConfig } = useAppContext();
  const { nostr } = useNostr();

  // Create SessionManager instance only once
  const sessionManager = useRef<SessionManager | undefined>(undefined);

  // Use refs so SessionManager always has the latest data
  const configRef = useRef(config);
  const defaultConfigRef = useRef(defaultConfig);
  const settingsRef = useRef(settings);
  const modelsRef = useRef(models);
  const userRef = useRef(user);
  const metadataRef = useRef(metadata);

  // Update refs when values change
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    defaultConfigRef.current = defaultConfig;
  }, [defaultConfig]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    modelsRef.current = models;
  }, [models]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    metadataRef.current = metadata;
  }, [metadata]);

  // Initialize SessionManager only once
  if (!sessionManager.current) {
    // Callbacks access refs to get latest values
    const getProviderModels = () => modelsRef.current;
    const getCurrentUser = () => ({ user: userRef.current, metadata: metadataRef.current });
    const getConfig = () => configRef.current;
    const getDefaultConfig = () => defaultConfigRef.current;
    const getSettings = () => settingsRef.current;

    sessionManager.current = new SessionManager(
      fs,
      nostr,
      getSettings,
      getConfig,
      getDefaultConfig,
      getProviderModels,
      getCurrentUser,
    );
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Fire and forget cleanup - we don't need to await in useEffect cleanup
      sessionManager.current?.cleanup().catch(error => {
        console.warn('Failed to cleanup session manager:', error);
      });
    };
  }, []);

  return (
    <SessionManagerContext.Provider value={sessionManager.current}>
      {children}
    </SessionManagerContext.Provider>
  );
}