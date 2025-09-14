import { useMemo } from 'react';
import { Git } from '@/lib/git';
import { useFS } from '@/hooks/useFS';

/**
 * Hook that provides a Git instance configured with the virtual filesystem
 * and appropriate CORS proxy for GitHub/GitLab repositories.
 */
export function useGit() {
  const { fs } = useFS();

  const git = useMemo(() => {
    return new Git(fs, 'https://cors.isomorphic-git.org');
  }, [fs]);

  return git;
}