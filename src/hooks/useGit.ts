import { useMemo } from 'react';
import { Git } from '@/lib/git';
import { useFS } from '@/hooks/useFS';
import { useGitSettings } from '@/hooks/useGitSettings';

/**
 * Hook that provides a Git instance configured with the virtual filesystem
 * and configurable CORS proxy for GitHub/GitLab repositories.
 */
export function useGit() {
  const { fs } = useFS();
  const { settings } = useGitSettings();

  const git = useMemo(() => {
    return new Git(fs, settings.corsProxy);
  }, [fs, settings.corsProxy]);

  return git;
}