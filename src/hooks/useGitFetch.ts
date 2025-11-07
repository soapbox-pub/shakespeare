import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useGit } from './useGit';
import { useFSPaths } from './useFSPaths';
import { useGitSettings } from './useGitSettings';
import { useToast } from './useToast';
import { findCredentialsForRepo } from '@/lib/gitCredentials';
import { useEffect, useRef } from 'react';

interface FetchResult {
  defaultBranch: string | null;
  defaultBranchOid: string | null;
  currentBranch: string | null;
  currentBranchOid: string | null;
  fetchedAt: number;
  hasChanges: boolean;
  remoteUrl: string | null;
}

/**
 * Hook to fetch updates from remote repository and detect changes.
 * Polls every 60 seconds and shows toast notifications when changes are detected.
 *
 * @param projectId - The project ID to fetch for
 * @returns Query result with manual refetch capability
 */
export function useGitFetch(projectId: string | null) {
  const { git } = useGit();
  const { projectsPath } = useFSPaths();
  const { settings } = useGitSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Track previous state to detect changes
  const previousStateRef = useRef<{
    defaultBranchOid: string | null;
    currentBranchOid: string | null;
  } | null>(null);

  const query = useQuery({
    queryKey: ['git-fetch', projectId],
    queryFn: async (): Promise<FetchResult> => {
      console.log('=== GIT FETCH STARTING ===');
      console.log('Project ID:', projectId);

      if (!projectId) {
        console.log('No project ID, returning empty result');
        return {
          defaultBranch: null,
          defaultBranchOid: null,
          currentBranch: null,
          currentBranchOid: null,
          fetchedAt: Date.now(),
          hasChanges: false,
          remoteUrl: null,
        };
      }

      try {
        const cwd = `${projectsPath}/${projectId}`;
        console.log('Working directory:', cwd);

        // Check if we're in a git repository
        try {
          await git.findRoot({ filepath: cwd });
          console.log('Git repository found');
        } catch {
          console.log('Not a git repository');
          return {
            defaultBranch: null,
            defaultBranchOid: null,
            currentBranch: null,
            currentBranchOid: null,
            fetchedAt: Date.now(),
            hasChanges: false,
            remoteUrl: null,
          };
        }

        // Get remotes
        const remotes = await git.listRemotes({ dir: cwd });
        console.log('Remotes found:', remotes);

        if (remotes.length === 0) {
          console.log('No remotes configured');
          return {
            defaultBranch: null,
            defaultBranchOid: null,
            currentBranch: null,
            currentBranchOid: null,
            fetchedAt: Date.now(),
            hasChanges: false,
            remoteUrl: null,
          };
        }

        const remote = remotes[0]; // Use first remote (usually 'origin')
        const remoteUrl = remote.url || null;
        console.log('Using remote:', remote.remote, 'URL:', remoteUrl);

        if (!remoteUrl) {
          console.log('No remote URL found');
          return {
            defaultBranch: null,
            defaultBranchOid: null,
            currentBranch: null,
            currentBranchOid: null,
            fetchedAt: Date.now(),
            hasChanges: false,
            remoteUrl: null,
          };
        }

        // Get credentials for authentication
        const credentials = findCredentialsForRepo(remoteUrl, settings.credentials);
        console.log('Credentials found:', !!credentials);

        // Get current branch before fetch
        let currentBranch: string | null = null;
        try {
          const branch = await git.currentBranch({
            dir: cwd,
            fullname: false,
          });
          currentBranch = (branch && branch.trim() !== '') ? branch : null;
          console.log('Current branch:', currentBranch);
        } catch (error) {
          console.warn('Could not get current branch:', error);
        }

        // Store OIDs before fetch
        let beforeDefaultOid: string | null = null;
        let beforeCurrentOid: string | null = null;

        // Get remote info to find default branch
        let defaultBranch: string | null = null;
        try {
          console.log('Fetching remote info...');
          const remoteInfo = await git.getRemoteInfo({
            url: remoteUrl,
            ...(credentials && {
              onAuth: () => ({
                username: credentials.username,
                password: credentials.password,
              }),
            }),
          });

          // Extract default branch from symbolic ref
          if (remoteInfo.refs?.HEAD?.type === 'symref') {
            const symref = remoteInfo.refs.HEAD.target;
            defaultBranch = symref?.replace('refs/heads/', '') || null;
            console.log('Default branch from remote:', defaultBranch);
          }

          // If we have a default branch, try to get its OID before fetch
          if (defaultBranch) {
            try {
              beforeDefaultOid = await git.resolveRef({
                dir: cwd,
                ref: `${remote.remote}/${defaultBranch}`,
              });
              console.log('Default branch OID before fetch:', beforeDefaultOid);
            } catch {
              console.log('Remote default branch not in local repo yet');
            }
          }
        } catch (error) {
          console.warn('Could not get remote info:', error);
        }

        // Get current branch OID before fetch
        if (currentBranch) {
          try {
            beforeCurrentOid = await git.resolveRef({
              dir: cwd,
              ref: `${remote.remote}/${currentBranch}`,
            });
            console.log('Current branch OID before fetch:', beforeCurrentOid);
          } catch {
            console.log('Remote current branch not in local repo yet');
          }
        }

        // Perform fetch
        try {
          console.log('Fetching from remote...');
          await git.fetch({
            dir: cwd,
            remote: remote.remote,
            ...(credentials && {
              onAuth: () => ({
                username: credentials.username,
                password: credentials.password,
              }),
            }),
          });
          console.log('Fetch completed successfully');
        } catch (error) {
          console.error('Failed to fetch from remote:', error);
          throw error;
        }

        // Get OIDs after fetch
        let afterDefaultOid: string | null = null;
        let afterCurrentOid: string | null = null;

        if (defaultBranch) {
          try {
            afterDefaultOid = await git.resolveRef({
              dir: cwd,
              ref: `${remote.remote}/${defaultBranch}`,
            });
            console.log('Default branch OID after fetch:', afterDefaultOid);
          } catch {
            console.log('Could not resolve default branch after fetch');
          }
        }

        if (currentBranch) {
          try {
            afterCurrentOid = await git.resolveRef({
              dir: cwd,
              ref: `${remote.remote}/${currentBranch}`,
            });
            console.log('Current branch OID after fetch:', afterCurrentOid);
          } catch {
            console.log('Could not resolve current branch after fetch');
          }
        }

        // Detect changes
        const defaultBranchChanged = beforeDefaultOid !== null &&
                                     afterDefaultOid !== null &&
                                     beforeDefaultOid !== afterDefaultOid;

        const currentBranchChanged = beforeCurrentOid !== null &&
                                     afterCurrentOid !== null &&
                                     beforeCurrentOid !== afterCurrentOid &&
                                     currentBranch !== defaultBranch; // Don't double-report if they're the same

        const hasChanges = defaultBranchChanged || currentBranchChanged;

        console.log('Changes detected:', {
          defaultBranchChanged,
          currentBranchChanged,
          hasChanges,
        });

        const result = {
          defaultBranch,
          defaultBranchOid: afterDefaultOid,
          currentBranch,
          currentBranchOid: afterCurrentOid,
          fetchedAt: Date.now(),
          hasChanges,
          remoteUrl,
        };

        console.log('=== GIT FETCH COMPLETE ===');
        console.log('Result:', result);

        return result;
      } catch (error) {
        console.error('Error fetching from remote:', error);
        throw error;
      }
    },
    enabled: !!projectId,
    refetchInterval: 60000, // Fetch every 60 seconds
    staleTime: 30000, // Consider data stale after 30 seconds
    retry: 1, // Only retry once on failure
  });

  // Show toast notifications when changes are detected
  useEffect(() => {
    if (!query.data || !query.isSuccess) {
      return;
    }

    const currentState = {
      defaultBranchOid: query.data.defaultBranchOid,
      currentBranchOid: query.data.currentBranchOid,
    };

    // Skip on first load
    if (previousStateRef.current === null) {
      previousStateRef.current = currentState;
      return;
    }

    const prevState = previousStateRef.current;

    // Detect default branch changes
    const defaultBranchChanged =
      prevState.defaultBranchOid !== null &&
      currentState.defaultBranchOid !== null &&
      prevState.defaultBranchOid !== currentState.defaultBranchOid;

    // Detect current branch changes
    const currentBranchChanged =
      prevState.currentBranchOid !== null &&
      currentState.currentBranchOid !== null &&
      prevState.currentBranchOid !== currentState.currentBranchOid &&
      query.data.currentBranch !== query.data.defaultBranch;

    // Show toast for default branch changes
    if (defaultBranchChanged && query.data.defaultBranch) {
      toast({
        title: 'Remote changes detected',
        description: `The ${query.data.defaultBranch} branch has new commits available.`,
        variant: 'default',
      });

      // Invalidate git status to show new ahead/behind counts
      queryClient.invalidateQueries({ queryKey: ['git-status', projectId] });
    }

    // Show toast for current branch changes (if different from default)
    if (currentBranchChanged && query.data.currentBranch) {
      toast({
        title: 'Remote changes detected',
        description: `The ${query.data.currentBranch} branch has new commits available.`,
        variant: 'default',
      });

      // Invalidate git status to show new ahead/behind counts
      queryClient.invalidateQueries({ queryKey: ['git-status', projectId] });
    }

    // Update previous state
    previousStateRef.current = currentState;
  }, [query.data, query.isSuccess, toast, queryClient, projectId]);

  return query;
}
