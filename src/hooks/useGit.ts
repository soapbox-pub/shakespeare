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
  const { corsProxy, ngitServers } = config;

  const git = useMemo(() => {
    return new Git({ fs, nostr, corsProxy, ngitServers });
  }, [fs, nostr, corsProxy, ngitServers]);

  return { git };
}