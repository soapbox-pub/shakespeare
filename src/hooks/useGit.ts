import { useMemo } from 'react';
import { Git } from '@/lib/git';
import { useFS } from '@/hooks/useFS';
import { useNostr } from '@nostrify/react';
import { useAppContext } from '@/hooks/useAppContext';

/**
 * Hook that provides a Git instance configured with the virtual filesystem
 * and configurable CORS proxy for GitHub/GitLab repositories.
 */
export function useGit(): { git: Git } {
  const { fs } = useFS();
  const { nostr } = useNostr();
  const { config } = useAppContext();
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
    return new Git({ fs, nostr, corsProxy, ngitServers });
  }, [fs, nostr, corsProxy, ngitServers]);

  return { git };
}