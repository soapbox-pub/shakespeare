import { useQuery } from '@tanstack/react-query';
import git from 'isomorphic-git';
import { useFS } from './useFS';

interface GitStatus {
  hasUncommittedChanges: boolean;
  changedFiles: string[];
  isGitRepo: boolean;
}

export function useGitStatus(projectId: string | null) {
  const { fs } = useFS();

  return useQuery({
    queryKey: ['git-status', projectId],
    queryFn: async (): Promise<GitStatus> => {
      if (!projectId) {
        return {
          hasUncommittedChanges: false,
          changedFiles: [],
          isGitRepo: false,
        };
      }

      try {
        const cwd = `/projects/${projectId}`;

        // Check if we're in a git repository
        try {
          await fs.stat(`${cwd}/.git`);
        } catch {
          return {
            hasUncommittedChanges: false,
            changedFiles: [],
            isGitRepo: false,
          };
        }

        // Get git status to see what files have changed
        const statusMatrix = await git.statusMatrix({
          fs,
          dir: cwd,
        });

        // Filter for files that have changes (not committed)
        const changedFiles = statusMatrix.filter(([_filepath, headStatus, workdirStatus, stageStatus]) => {
          // File has changes if:
          // - workdir differs from head (modified/new/deleted)
          // - stage differs from workdir (unstaged changes)
          return headStatus !== workdirStatus || workdirStatus !== stageStatus;
        });

        return {
          hasUncommittedChanges: changedFiles.length > 0,
          changedFiles: changedFiles.map(([filepath]) => filepath),
          isGitRepo: true,
        };
      } catch (error) {
        console.error('Error checking git status:', error);
        return {
          hasUncommittedChanges: false,
          changedFiles: [],
          isGitRepo: false,
        };
      }
    },
    enabled: !!projectId,
    refetchInterval: 5000, // Check every 5 seconds
    staleTime: 2000, // Consider data stale after 2 seconds
  });
}