import { useQuery } from '@tanstack/react-query';
import git from 'isomorphic-git';
import { useFS } from './useFS';

interface GitFileChange {
  filepath: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'staged';
}

interface GitCommit {
  oid: string;
  message: string;
  author: {
    name: string;
    email: string;
    timestamp: number;
  };
  committer: {
    name: string;
    email: string;
    timestamp: number;
  };
}

interface GitRemote {
  name: string;
  url: string;
}

interface GitStatus {
  hasUncommittedChanges: boolean;
  changedFiles: GitFileChange[];
  isGitRepo: boolean;
  currentBranch: string | null;
  latestCommit: GitCommit | null;
  remotes: GitRemote[];
  totalCommits: number;
  branches: string[];
  ahead: number;
  behind: number;
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
          currentBranch: null,
          latestCommit: null,
          remotes: [],
          totalCommits: 0,
          branches: [],
          ahead: 0,
          behind: 0,
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
            currentBranch: null,
            latestCommit: null,
            remotes: [],
            totalCommits: 0,
            branches: [],
            ahead: 0,
            behind: 0,
          };
        }

        // Get current branch
        let currentBranch: string | null = null;
        try {
          const branch = await git.currentBranch({
            fs,
            dir: cwd,
            fullname: false,
          });
          currentBranch = branch || null;
        } catch (error) {
          console.warn('Could not get current branch:', error);
        }

        // Get all branches
        const branches: string[] = [];
        try {
          const allBranches = await git.listBranches({
            fs,
            dir: cwd,
          });
          branches.push(...allBranches);
        } catch (error) {
          console.warn('Could not list branches:', error);
        }

        // Get latest commit
        let latestCommit: GitCommit | null = null;
        let totalCommits = 0;
        try {
          const commits = await git.log({
            fs,
            dir: cwd,
            depth: 1,
          });

          if (commits.length > 0) {
            const commit = commits[0];
            latestCommit = {
              oid: commit.oid,
              message: commit.commit.message,
              author: {
                name: commit.commit.author.name,
                email: commit.commit.author.email,
                timestamp: commit.commit.author.timestamp,
              },
              committer: {
                name: commit.commit.committer.name,
                email: commit.commit.committer.email,
                timestamp: commit.commit.committer.timestamp,
              },
            };
          }

          // Get total commit count
          const allCommits = await git.log({
            fs,
            dir: cwd,
          });
          totalCommits = allCommits.length;
        } catch (error) {
          console.warn('Could not get commit history:', error);
        }

        // Get remotes
        const remotes: GitRemote[] = [];
        try {
          const remoteNames = await git.listRemotes({
            fs,
            dir: cwd,
          });

          for (const remote of remoteNames) {
            remotes.push({
              name: remote.remote,
              url: remote.url,
            });
          }
        } catch (error) {
          console.warn('Could not get remotes:', error);
        }

        // Get git status to see what files have changed
        const statusMatrix = await git.statusMatrix({
          fs,
          dir: cwd,
        });

        // Parse file changes with more detailed status
        const changedFiles: GitFileChange[] = [];
        for (const [filepath, headStatus, workdirStatus, stageStatus] of statusMatrix) {
          let status: GitFileChange['status'];

          if (headStatus === 0 && workdirStatus === 2 && stageStatus === 0) {
            status = 'untracked';
          } else if (headStatus === 0 && workdirStatus === 2 && stageStatus === 2) {
            status = 'added';
          } else if (headStatus === 1 && workdirStatus === 2 && stageStatus === 2) {
            status = 'staged';
          } else if (headStatus === 1 && workdirStatus === 2 && stageStatus === 1) {
            status = 'modified';
          } else if (headStatus === 1 && workdirStatus === 0 && stageStatus === 0) {
            status = 'deleted';
          } else if (headStatus !== workdirStatus || workdirStatus !== stageStatus) {
            status = 'modified';
          } else {
            continue; // No changes
          }

          changedFiles.push({
            filepath,
            status,
          });
        }

        // Calculate ahead/behind (simplified - would need remote tracking branch info)
        const ahead = 0;
        const behind = 0;
        try {
          // This is a simplified calculation - in a real implementation,
          // you'd compare with the remote tracking branch
          if (currentBranch && remotes.length > 0) {
            // For now, we'll leave these as 0 since calculating ahead/behind
            // requires more complex remote branch comparison
          }
        } catch (error) {
          console.warn('Could not calculate ahead/behind:', error);
        }

        return {
          hasUncommittedChanges: changedFiles.length > 0,
          changedFiles,
          isGitRepo: true,
          currentBranch,
          latestCommit,
          remotes,
          totalCommits,
          branches,
          ahead,
          behind,
        };
      } catch (error) {
        console.error('Error checking git status:', error);
        return {
          hasUncommittedChanges: false,
          changedFiles: [],
          isGitRepo: false,
          currentBranch: null,
          latestCommit: null,
          remotes: [],
          totalCommits: 0,
          branches: [],
          ahead: 0,
          behind: 0,
        };
      }
    },
    enabled: !!projectId,
    refetchInterval: 5000, // Check every 5 seconds
    staleTime: 2000, // Consider data stale after 2 seconds
  });
}