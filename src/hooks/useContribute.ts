import { useState, useCallback } from 'react';
import { useFS } from './useFS';
import { useGit } from './useGit';
import { useGitSettings } from './useGitSettings';
import { useAppContext } from './useAppContext';
import { createGitHostProvider, parseRepoUrl, detectGitHost } from '@/lib/git-hosts';
import type { PullRequest } from '@/lib/git-hosts';

export interface ContributeState {
  isLoading: boolean;
  error: string | null;
  step: 'idle' | 'auth' | 'prepare' | 'fork' | 'push' | 'pr' | 'complete';
  message?: string;
  pr?: PullRequest;
}

export interface ContributeOptions {
  projectDir: string;
  branchName: string;
  commitMessage: string;
  prTitle: string;
  prBody?: string;
  maintainerCanModify?: boolean;
}

export function useContribute() {
  const { fs } = useFS();
  const { git } = useGit();
  const { settings, addHostToken } = useGitSettings();
  const { config } = useAppContext();

  const [state, setState] = useState<ContributeState>({
    isLoading: false,
    error: null,
    step: 'idle',
  });

  /**
   * Get the current repository's upstream URL
   */
  const getUpstreamUrl = useCallback(async (projectDir: string): Promise<string | null> => {
    try {
      // Try to get upstream remote first
      const upstreamUrl = await git.getRemoteURL(projectDir, 'upstream');
      if (upstreamUrl) return upstreamUrl;

      // Fall back to origin
      const originUrl = await git.getRemoteURL(projectDir, 'origin');
      return originUrl;
    } catch {
      return null;
    }
  }, [git]);

  /**
   * Check if user needs to authenticate with the Git host
   */
  const needsAuth = useCallback(async (projectDir: string): Promise<{ needsAuth: boolean; host?: string; url?: string }> => {
    const url = await getUpstreamUrl(projectDir);
    if (!url) {
      return { needsAuth: false };
    }

    const hostType = detectGitHost(url);
    if (hostType === 'unknown') {
      return { needsAuth: false };
    }

    // Extract hostname
    const hostname = new URL(url.replace(/^git@/, 'https://').replace(/\.git$/, '')).hostname;

    // Check if we have a token for this host
    const hasToken = !!settings.hostTokens[hostname];

    return {
      needsAuth: !hasToken,
      host: hostname,
      url,
    };
  }, [getUpstreamUrl, settings.hostTokens]);

  /**
   * Add authentication token for a Git host
   */
  const authenticate = useCallback((host: string, token: string, username?: string) => {
    addHostToken(host, {
      token,
      username,
      createdAt: Date.now(),
    });
  }, [addHostToken]);

  /**
   * Execute the complete contribution workflow
   */
  const contribute = useCallback(async (options: ContributeOptions): Promise<PullRequest | null> => {
    setState({ isLoading: true, error: null, step: 'prepare' });

    try {
      // 1. Get upstream repository info
      const upstreamUrl = await getUpstreamUrl(options.projectDir);
      if (!upstreamUrl) {
        throw new Error('No remote repository found. This project must be cloned from a Git repository.');
      }

      const parsed = parseRepoUrl(upstreamUrl);
      if (!parsed) {
        throw new Error('Invalid repository URL format');
      }

      const hostname = new URL(upstreamUrl.replace(/^git@/, 'https://').replace(/\.git$/, '')).hostname;
      const hostToken = settings.hostTokens[hostname];

      if (!hostToken) {
        throw new Error(`Not authenticated with ${hostname}. Please connect your account first.`);
      }

      // Create Git host provider
      const provider = createGitHostProvider(upstreamUrl, { token: hostToken.token }, config.corsProxy);
      if (!provider) {
        throw new Error('Unsupported Git hosting provider');
      }

      setState(prev => ({ ...prev, step: 'auth', message: 'Checking permissions...' }));

      // 2. Get repository and check permissions
      const repo = await provider.getRepository(parsed.owner, parsed.repo);
      const canPush = await provider.canUserPush(parsed.owner, parsed.repo);
      const currentUser = await provider.getCurrentUser();

      let forkUrl: string | null = null;
      let forkFullName: string | null = null;

      // 3. Fork if necessary
      if (!canPush) {
        setState(prev => ({ ...prev, step: 'fork', message: 'Creating your copy of the project...' }));

        // Check if fork already exists
        let fork = await provider.getFork(parsed.owner, parsed.repo, currentUser.username);

        if (!fork) {
          // Create fork
          fork = await provider.createFork(parsed.owner, parsed.repo);
          
          // Wait for fork to be ready
          fork = await provider.waitForFork(parsed.owner, parsed.repo, currentUser.username, 30000);
        }

        forkUrl = fork.cloneUrl;
        forkFullName = fork.fullName;

        // Configure remotes: upstream = original, origin = fork
        try {
          await git.addRemote({
            dir: options.projectDir,
            remote: 'upstream',
            url: upstreamUrl,
          });
        } catch {
          // upstream might already exist, update it
          await git.deleteRemote({ dir: options.projectDir, remote: 'upstream' });
          await git.addRemote({
            dir: options.projectDir,
            remote: 'upstream',
            url: upstreamUrl,
          });
        }

        // Update origin to point to fork
        await git.deleteRemote({ dir: options.projectDir, remote: 'origin' });
        await git.addRemote({
          dir: options.projectDir,
          remote: 'origin',
          url: forkUrl,
        });
      } else {
        forkFullName = `${parsed.owner}/${parsed.repo}`;
      }

      // 4. Create and switch to feature branch
      setState(prev => ({ ...prev, step: 'prepare', message: 'Preparing changes...' }));

      const currentBranch = await git.currentBranch({ dir: options.projectDir });
      
      // If we're already on the feature branch, that's fine
      if (currentBranch !== options.branchName) {
        // Create branch from current HEAD
        await git.branch({
          dir: options.projectDir,
          ref: options.branchName,
          checkout: true,
        });
      }

      // 5. Commit all changes
      const statusMatrix = await git.statusMatrix({ dir: options.projectDir });
      const hasChanges = statusMatrix.some(([, head, workdir]) => head !== workdir);

      if (hasChanges) {
        // Stage all changes
        for (const [filepath, , workdir] of statusMatrix) {
          if (workdir === 0) {
            // File deleted
            await git.remove({ dir: options.projectDir, filepath });
          } else {
            // File added or modified
            await git.add({ dir: options.projectDir, filepath });
          }
        }

        // Commit
        await git.commit({
          dir: options.projectDir,
          message: options.commitMessage,
        });
      }

      // 6. Push to remote
      setState(prev => ({ ...prev, step: 'push', message: 'Uploading your changes...' }));

      const credentials = settings.credentials[forkUrl || upstreamUrl] || 
                         settings.credentials[`https://${hostname}`] ||
                         { username: hostToken.username || currentUser.username, password: hostToken.token };

      await git.push({
        dir: options.projectDir,
        remote: 'origin',
        ref: options.branchName,
        onAuth: () => credentials,
      });

      // 7. Create pull request
      setState(prev => ({ ...prev, step: 'pr', message: 'Creating pull request...' }));

      const pr = await provider.createPullRequest({
        title: options.prTitle,
        body: options.prBody,
        headBranch: options.branchName,
        baseBranch: repo.defaultBranch,
        headRepo: forkFullName!,
        baseRepo: `${parsed.owner}/${parsed.repo}`,
        maintainerCanModify: options.maintainerCanModify ?? true,
      });

      setState({
        isLoading: false,
        error: null,
        step: 'complete',
        message: 'Pull request created successfully!',
        pr,
      });

      return pr;
    } catch (error) {
      console.error('Contribution error:', error);
      setState({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create pull request',
        step: 'idle',
      });
      return null;
    }
  }, [getUpstreamUrl, settings, config.corsProxy, git, addHostToken]);

  /**
   * Update an existing pull request by pushing new commits
   */
  const updatePR = useCallback(async (
    projectDir: string,
    branchName: string,
    commitMessage: string
  ): Promise<boolean> => {
    setState({ isLoading: true, error: null, step: 'prepare' });

    try {
      // Get current branch
      const currentBranch = await git.currentBranch({ dir: projectDir });
      
      if (currentBranch !== branchName) {
        // Checkout the PR branch
        await git.checkout({
          dir: projectDir,
          ref: branchName,
        });
      }

      // Commit changes
      const statusMatrix = await git.statusMatrix({ dir: projectDir });
      const hasChanges = statusMatrix.some(([, head, workdir]) => head !== workdir);

      if (!hasChanges) {
        setState({
          isLoading: false,
          error: null,
          step: 'complete',
          message: 'No changes to commit',
        });
        return true;
      }

      // Stage all changes
      for (const [filepath, , workdir] of statusMatrix) {
        if (workdir === 0) {
          await git.remove({ dir: projectDir, filepath });
        } else {
          await git.add({ dir: projectDir, filepath });
        }
      }

      await git.commit({
        dir: projectDir,
        message: commitMessage,
      });

      // Push to remote
      setState(prev => ({ ...prev, step: 'push', message: 'Uploading updates...' }));

      const originUrl = await git.getRemoteURL(projectDir, 'origin');
      if (!originUrl) {
        throw new Error('No origin remote found');
      }

      const hostname = new URL(originUrl.replace(/^git@/, 'https://').replace(/\.git$/, '')).hostname;
      const hostToken = settings.hostTokens[hostname];

      if (!hostToken) {
        throw new Error(`Not authenticated with ${hostname}`);
      }

      const credentials = settings.credentials[originUrl] || 
                         settings.credentials[`https://${hostname}`] ||
                         { username: hostToken.username || 'git', password: hostToken.token };

      await git.push({
        dir: projectDir,
        remote: 'origin',
        ref: branchName,
        onAuth: () => credentials,
      });

      setState({
        isLoading: false,
        error: null,
        step: 'complete',
        message: 'Pull request updated successfully!',
      });

      return true;
    } catch (error) {
      console.error('Update PR error:', error);
      setState({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to update pull request',
        step: 'idle',
      });
      return false;
    }
  }, [git, settings]);

  return {
    ...state,
    needsAuth,
    authenticate,
    contribute,
    updatePR,
  };
}
