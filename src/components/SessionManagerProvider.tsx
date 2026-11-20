import { ReactNode, useEffect, useRef } from 'react';
import { useNostrLogin } from '@nostrify/react/login';
import { SessionManagerContext } from '@/contexts/SessionManagerContext';
import { SessionManager } from '@/lib/SessionManager';
import { DeferredSessionManager } from '@/lib/agent/DeferredSessionManager';
import { RemoteSessionManager, detectWorkerAgent } from '@/lib/agent/RemoteSessionManager';
import type { AgentContext } from '@/lib/agent/protocol';
import { resolveImageGeneration } from '@/lib/tools/workerTools';
import { useFS } from '@/hooks/useFS';
import { useAISettings } from '@/hooks/useAISettings';
import { useProviderModels } from '@/hooks/useProviderModels';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAppContext } from '@/hooks/useAppContext';
import { useGitSettings } from '@/hooks/useGitSettings';
import { useNostr } from '@nostrify/react';

interface SessionManagerProviderProps {
  children: ReactNode;
}

/**
 * Provider that creates and manages the global session manager instance.
 *
 * Where Din runs Shakespeare as an app whose service worker can run tasks with its windows closed,
 * the assistant runs in the service worker and this page talks to it (`RemoteSessionManager`).
 * Everywhere else it runs in this page (`SessionManager`).
 */
export function SessionManagerProvider({ children }: SessionManagerProviderProps) {
  const { fs } = useFS();
  const { settings } = useAISettings();
  const { models } = useProviderModels();
  const { user, metadata } = useCurrentUser();
  const { logins } = useNostrLogin();
  const { config, defaultConfig } = useAppContext();
  const { settings: gitSettings } = useGitSettings();
  const { nostr } = useNostr();

  // Create SessionManager instance only once
  const sessionManager = useRef<DeferredSessionManager | undefined>(undefined);

  // Use refs so SessionManager always has the latest data
  const configRef = useRef(config);
  const defaultConfigRef = useRef(defaultConfig);
  const settingsRef = useRef(settings);
  const modelsRef = useRef(models);
  const userRef = useRef(user);
  const metadataRef = useRef(metadata);
  const loginRef = useRef(logins[0]);
  const gitCredentialsRef = useRef(gitSettings.credentials);

  // Update refs when values change
  useEffect(() => {
    configRef.current = config;
    defaultConfigRef.current = defaultConfig;
    settingsRef.current = settings;
    modelsRef.current = models;
    userRef.current = user;
    metadataRef.current = metadata;
    loginRef.current = logins[0];
    gitCredentialsRef.current = gitSettings.credentials;

    // An assistant in the service worker needs the latest settings for the work it's doing
    const current = sessionManager.current?.current;
    if (current instanceof RemoteSessionManager) current.updateContext();
  }, [config, defaultConfig, settings, models, user, metadata, logins, gitSettings.credentials]);

  // Initialize SessionManager only once
  if (!sessionManager.current) {
    // Callbacks access refs to get latest values
    const getProviderModels = () => modelsRef.current;
    const getCurrentUser = () => ({ user: userRef.current, metadata: metadataRef.current });
    const getConfig = () => configRef.current;
    const getDefaultConfig = () => defaultConfigRef.current;
    const getSettings = () => settingsRef.current;

    // Everything the service worker needs to know of this page's state
    const getContext = (): AgentContext => {
      const login = loginRef.current;
      return {
        config: configRef.current,
        defaultConfig: defaultConfigRef.current,
        settings: {
          providers: settingsRef.current.providers,
          imageModel: settingsRef.current.imageModel,
          reasoningEffort: settingsRef.current.reasoningEffort,
        },
        models: modelsRef.current.map((model) => ({
          id: model.id,
          provider: model.provider,
          contextLength: model.contextLength,
          pricing: model.pricing && {
            prompt: model.pricing.prompt.toString(),
            completion: model.pricing.completion.toString(),
          },
        })),
        login: login && { type: login.type, pubkey: login.pubkey, data: login.data },
        metadata: metadataRef.current,
        gitCredentials: gitCredentialsRef.current,
        imageGeneration: resolveImageGeneration(settingsRef.current, modelsRef.current),
      };
    };

    sessionManager.current = new DeferredSessionManager(
      async () => {
        const instance = await detectWorkerAgent();
        if (instance) {
          console.log('Running the assistant in the service worker');
          return new RemoteSessionManager({
            instance,
            fs,
            getContext,
            getSigner: () => userRef.current && { pubkey: userRef.current.pubkey, signer: userRef.current.signer },
          });
        }
        return new SessionManager(
          fs,
          nostr,
          getSettings,
          getConfig,
          getDefaultConfig,
          getProviderModels,
          getCurrentUser,
        );
      },
      async (impl) => {
        if (impl instanceof RemoteSessionManager) {
          await impl.sync().catch((error) => console.warn('Failed to sync with the service worker:', error));
        }
      },
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
