import { useMemo } from 'react';
import { Git } from '@/lib/git';
import { useFS } from '@/hooks/useFS';
import { useNostr } from '@nostrify/react';
import { useAppContext } from '@/hooks/useAppContext';
import { useGitSettings } from './useGitSettings';
import { useCurrentUser } from './useCurrentUser';

/**
 * Hook that provides a Git instance configured with the virtual filesystem
 * and configurable CORS proxy for GitHub/GitLab repositories.
 */
export function useGit(): { git: Git } {
  const { fs } = useFS();
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { config } = useAppContext();
  const { settings } = useGitSettings();
  const { corsProxy, graspMetadata } = config;

  const ngitServers = useMemo(() => {
    // Extract hostnames from grasp relay URLs for backwards compatibility with Git class
    return graspMetadata.relays.map(r => {
      try {
        const url = new URL(r.url);
        return url.hostname;
      } catch {
        return undefined;
      }
    }).filter((hostname): hostname is string => Boolean(hostname));
  }, [graspMetadata.relays]);

  const git = useMemo(() => {
    return new Git({
      fs,
      nostr,
      corsProxy,
      ngitServers,
      credentials: settings.credentials,
      signer: user?.signer,
    });
  }, [fs, nostr, corsProxy, ngitServers, settings.credentials, user?.signer]);

  return { git };
}