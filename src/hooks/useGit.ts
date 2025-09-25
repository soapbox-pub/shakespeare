import { useMemo } from 'react';
import { Git } from '@/lib/git';
import { useFS } from '@/hooks/useFS';
import { useNostr } from '@nostrify/react';
import { useGitSettings } from '@/hooks/useGitSettings';

/**
 * Hook that provides a Git instance configured with the virtual filesystem
 * and configurable CORS proxy for GitHub/GitLab repositories.
 */
export function useGit(): { git: Git } {
  const { fs } = useFS();
  const { nostr } = useNostr();
  const { settings } = useGitSettings();
  const { corsProxy } = settings;

  const git = useMemo(() => {
    return new Git({ fs, nostr, corsProxy });
  }, [fs, nostr, corsProxy]);

  return { git };
}