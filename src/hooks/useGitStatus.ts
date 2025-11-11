import { useQuery } from '@tanstack/react-query';
import { useGit } from './useGit';
import { useFSPaths } from './useFSPaths';

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
  remoteBranchExists: boolean;
}

export function useGitStatus(projectId: string | null) {
  const { git } = useGit();
  const { projectsPath } = useFSPaths();

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
          remoteBranchExists: false,
        };
      }

      try {
        const cwd = `${projectsPath}/${projectId}`;

        // Check if we're in a git repository
        try {
          await git.findRoot({ filepath: cwd });
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
            remoteBranchExists: false,
          };
        }

        // Get current branch
        let currentBranch: string | null = null;
        try {
          const branch = await git.currentBranch({
            dir: cwd,
            fullname: false,
          });
          // Ensure we have a valid branch name (not empty string or undefined)
          currentBranch = (branch && branch.trim() !== '') ? branch : null;
        } catch (error) {
          console.warn('Could not get current branch:', error);
        }

        // Get all branches
        const branches: string[] = [];
        try {
          const allBranches = await git.listBranches({
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
            dir: cwd,
          });

          for (const remote of remoteNames) {
            // Skip remotes with empty names
            if (!remote.remote || !remote.url) {
              console.warn('Skipping remote with empty name or URL:', remote);
              continue;
            }
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

        // Calculate ahead/behind
        let ahead = 0;
        let behind = 0;
        let remoteBranchExists = false;
        try {
          if (currentBranch && remotes.length > 0) {
            const remote = remotes[0]; // Use first remote (usually 'origin')

            // Validate remote and branch names before constructing ref
            if (!remote.name || !currentBranch) {
              console.warn('Invalid remote or branch name for ahead/behind calculation');
              throw new Error('Invalid remote or branch name');
            }

            const remoteBranchName = `${remote.name}/${currentBranch}`;

            try {
              // Try to get the remote branch reference
              const remoteRef = await git.resolveRef({
                dir: cwd,
                ref: remoteBranchName,
              });

              const localRef = await git.resolveRef({
                dir: cwd,
                ref: currentBranch,
              });

              // Remote branch exists!
              remoteBranchExists = true;

              if (remoteRef && localRef && remoteRef !== localRef) {
                // Get commits between local and remote
                const localCommits = await git.log({
                  dir: cwd,
                  ref: currentBranch,
                });

                const remoteCommits = await git.log({
                  dir: cwd,
                  ref: remoteBranchName,
                });

                // Find commits that are in local but not in remote (ahead)
                const remoteCommitOids = new Set(remoteCommits.map(c => c.oid));
                const localOnlyCommits = localCommits.filter(c => !remoteCommitOids.has(c.oid));
                ahead = localOnlyCommits.length;

                // Find commits that are in remote but not in local (behind)
                const localCommitOids = new Set(localCommits.map(c => c.oid));
                const remoteOnlyCommits = remoteCommits.filter(c => !localCommitOids.has(c.oid));
                behind = remoteOnlyCommits.length;
              }
            } catch {
              // Remote branch doesn't exist
              remoteBranchExists = false;
            }
          }
        } catch (err) {
          console.warn('Could not calculate ahead/behind:', err);
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
          remoteBranchExists,
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
          remoteBranchExists: false,
        };
      }
    },
    enabled: !!projectId,
    refetchInterval: 5000, // Check every 5 seconds
    staleTime: 2000, // Consider data stale after 2 seconds
  });
}