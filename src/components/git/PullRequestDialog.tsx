import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  GitPullRequest,
  Loader2,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  GitCompare,
  GitFork,
} from 'lucide-react';
import { useGit } from '@/hooks/useGit';
import { useGitSettings } from '@/hooks/useGitSettings';
import { useToast } from '@/hooks/useToast';
import { findCredentialsForRepo } from '@/lib/gitCredentials';

interface PullRequestDialogProps {
  projectId: string;
  currentBranch: string | null;
  remoteUrl?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface RemoteInfo {
  owner: string;
  repo: string;
  platform: 'github' | 'gitlab';
  apiUrl: string;
}

interface ForkInfo {
  needsFork: boolean;
  forkOwner?: string;
  forkRepo?: string;
  forkUrl?: string;
}

export function PullRequestDialog({
  projectId,
  currentBranch,
  remoteUrl,
  open,
  onOpenChange,
}: PullRequestDialogProps) {
  const [isOpen, setIsOpen] = useState(open ?? false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetBranch, setTargetBranch] = useState('main');
  const [remoteBranches, setRemoteBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [remoteInfo, setRemoteInfo] = useState<RemoteInfo | null>(null);
  const [forkInfo, setForkInfo] = useState<ForkInfo>({ needsFork: false });
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(false);
  const [createdPrUrl, setCreatedPrUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { git } = useGit();
  const { settings } = useGitSettings();
  const { toast } = useToast();
  const projectPath = `/projects/${projectId}`;

  useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);

  const loadRemoteBranches = useCallback(async () => {
    setIsLoadingBranches(true);
    try {
      const branches = await git.listBranches({
        dir: projectPath,
        remote: 'origin',
      });
      setRemoteBranches(branches);

      // Set default target branch
      if (branches.includes('main')) {
        setTargetBranch('main');
      } else if (branches.includes('master')) {
        setTargetBranch('master');
      } else if (branches.length > 0) {
        setTargetBranch(branches[0]);
      }
    } catch (err) {
      console.warn('Failed to load remote branches:', err);
      // Set default branches if we can't fetch
      setRemoteBranches(['main', 'master', 'develop']);
    } finally {
      setIsLoadingBranches(false);
    }
  }, [git, projectPath]);

  useEffect(() => {
    if (isOpen && remoteUrl) {
      parseRemoteUrl(remoteUrl);
      loadRemoteBranches();
    }
  }, [isOpen, remoteUrl, loadRemoteBranches]);

  // Check permissions after remoteInfo is set
  useEffect(() => {
    if (remoteInfo && remoteUrl) {
      checkPermissionsAndFork();
    }
  }, [remoteInfo, remoteUrl, checkPermissionsAndFork]);

  const checkPermissionsAndFork = useCallback(async () => {
    if (!remoteInfo || !remoteUrl) {
      console.log('checkPermissionsAndFork: No remoteInfo or remoteUrl');
      return;
    }

    console.log('=== CHECK PERMISSIONS AND FORK ===');
    console.log('Remote info:', remoteInfo);

    setIsCheckingPermissions(true);
    try {
      const credentials = findCredentialsForRepo(remoteUrl, settings.credentials);
      if (!credentials) {
        console.log('No credentials found, skipping fork check');
        setForkInfo({ needsFork: false });
        return;
      }

      console.log('Credentials found, checking push permissions...');

      // Check if user can push to the repo
      const canPush = await checkPushPermissions(remoteInfo, credentials.password);
      console.log('Can push to repo:', canPush);

      if (!canPush) {
        console.log('User cannot push, need to fork');
        // User needs to fork - check if fork exists or create one
        const fork = await ensureFork(remoteInfo, credentials.password);
        console.log('Fork ensured, setting fork info:', fork);
        setForkInfo({
          needsFork: true,
          forkOwner: fork.owner,
          forkRepo: fork.repo,
          forkUrl: fork.url,
        });
      } else {
        console.log('User can push directly, no fork needed');
        setForkInfo({ needsFork: false });
      }
    } catch (err) {
      console.error('Error checking permissions:', err);
      // If we can't check, assume direct push (existing behavior)
      setForkInfo({ needsFork: false });
    } finally {
      setIsCheckingPermissions(false);
    }
  }, [remoteInfo, remoteUrl, settings.credentials]);

  const parseRemoteUrl = (url: string) => {
    setError(null);
    try {
      // Parse GitHub/GitLab URLs
      let match;
      let owner = '';
      let repo = '';
      let platform: 'github' | 'gitlab' = 'github';
      let apiUrl = '';

      console.log('Parsing remote URL:', url);

      // Normalize URL - remove .git suffix if present
      const normalizedUrl = url.replace(/\.git$/, '');

      // GitHub SSH: git@github.com:owner/repo
      match = normalizedUrl.match(/git@github\.com:([^/]+)\/(.+)$/);
      if (match) {
        owner = match[1];
        repo = match[2];
        platform = 'github';
        apiUrl = 'https://api.github.com';
        console.log('Detected GitHub SSH:', { owner, repo });
      }

      // GitHub HTTPS: https://github.com/owner/repo
      if (!match) {
        match = normalizedUrl.match(/https?:\/\/github\.com\/([^/]+)\/(.+)$/);
        if (match) {
          owner = match[1];
          repo = match[2];
          platform = 'github';
          apiUrl = 'https://api.github.com';
          console.log('Detected GitHub HTTPS:', { owner, repo });
        }
      }

      // GitLab SSH: git@gitlab.com:owner/repo
      if (!match) {
        match = normalizedUrl.match(/git@gitlab\.com:([^/]+)\/(.+)$/);
        if (match) {
          owner = match[1];
          repo = match[2];
          platform = 'gitlab';
          apiUrl = 'https://gitlab.com/api/v4';
          console.log('Detected GitLab SSH:', { owner, repo });
        }
      }

      // GitLab HTTPS: https://gitlab.com/owner/repo
      if (!match) {
        match = normalizedUrl.match(/https?:\/\/gitlab\.com\/([^/]+)\/(.+)$/);
        if (match) {
          owner = match[1];
          repo = match[2];
          platform = 'gitlab';
          apiUrl = 'https://gitlab.com/api/v4';
          console.log('Detected GitLab HTTPS:', { owner, repo });
        }
      }

      if (owner && repo) {
        console.log('Remote info set:', { owner, repo, platform, apiUrl });
        setRemoteInfo({ owner, repo, platform, apiUrl });
      } else {
        console.error('Failed to parse URL - no owner/repo found:', url);
        setError('Unsupported remote URL format. Only GitHub and GitLab URLs are supported (e.g., https://github.com/user/repo.git)');
      }
    } catch (err) {
      console.error('Error parsing remote URL:', err);
      setError('Failed to parse remote URL: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const createPullRequest = async () => {
    if (!remoteInfo || !currentBranch) return;

    if (!title.trim()) {
      toast({
        title: 'Title required',
        description: 'Please enter a title for the pull request',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      console.log('Creating PR for:', remoteInfo);
      console.log('Remote URL:', remoteUrl);

      // Check if user is on main/master - if so, create a feature branch
      let branchToUse = currentBranch;
      const isOnDefaultBranch = currentBranch === 'main' || currentBranch === 'master';

      if (isOnDefaultBranch) {
        console.log(`User is on default branch '${currentBranch}', creating feature branch`);

        // Generate branch name from PR title
        const sanitizedTitle = title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single
          .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
          .substring(0, 50); // Limit length

        // Ensure we have a valid base name
        const baseName = sanitizedTitle || 'feature';
        const featureBranchName = `${baseName}-${Date.now().toString(36).slice(-4)}`;
        console.log(`Creating feature branch: ${featureBranchName}`);

        try {
          // IMPORTANT: Create branch FIRST, then commit to it
          // This ensures main and feature-branch have different commits

          // Check if there are uncommitted changes BEFORE branching
          const statusMatrix = await git.statusMatrix({ dir: projectPath });
          const hasUncommittedChanges = statusMatrix.some(([, head, workdir]) => head !== workdir);

          // Create and checkout the new branch from current HEAD
          await git.branch({
            dir: projectPath,
            ref: featureBranchName,
            checkout: true,
          });

          branchToUse = featureBranchName;
          console.log(`Successfully created and checked out branch: ${featureBranchName}`);

          // If there were uncommitted changes, commit them now to the new branch
          if (hasUncommittedChanges) {
            console.log('Found uncommitted changes, committing to new branch');

            // Stage all changes
            for (const [filepath, , workdir] of statusMatrix) {
              if (workdir === 0) {
                await git.remove({ dir: projectPath, filepath });
              } else if (workdir !== 0) {
                await git.add({ dir: projectPath, filepath });
              }
            }

            // Commit with the PR title as message
            await git.commit({
              dir: projectPath,
              message: title,
            });

            console.log('Committed changes to new branch');

            toast({
              title: 'Feature branch created',
              description: `Created '${featureBranchName}' with your changes committed`,
            });
          } else {
            // No uncommitted changes - the branch should already differ from main
            // (user must have committed changes to main already)
            console.log('No uncommitted changes, branch created from existing commits');

            toast({
              title: 'Feature branch created',
              description: `Created branch '${featureBranchName}'`,
            });
          }
        } catch (branchError) {
          console.error('Failed to create feature branch:', branchError);
          throw new Error(
            `Cannot create PR from '${currentBranch}' branch.\n\n` +
            `Failed to create a feature branch automatically.\n` +
            `Please create a new branch manually in the Branches tab first.\n\n` +
            `Error: ${branchError instanceof Error ? branchError.message : 'Unknown error'}`
          );
        }
      }

      // Get credentials
      const credentials = findCredentialsForRepo(remoteUrl || '', settings.credentials);
      console.log('Found credentials:', credentials ? 'Yes' : 'No');
      console.log('Available credential origins:', Object.keys(settings.credentials));

      if (credentials) {
        console.log('Credential username:', credentials.username);
        console.log('Credential password length:', credentials.password?.length || 0);
      }

      if (!credentials) {
        throw new Error(
          `No credentials found for ${remoteInfo.platform === 'github' ? 'GitHub' : 'GitLab'}. Please add credentials in Settings > Git for ${remoteUrl}`
        );
      }

      if (!credentials.password || credentials.password.trim() === '') {
        throw new Error(
          `Credentials found but token is empty. Please check your ${remoteInfo.platform === 'github' ? 'GitHub' : 'GitLab'} token in Settings > Git`
        );
      }

      // If fork is needed, we need to push the branch to the fork first
      let headRef = branchToUse;

      console.log('=== PR HEAD REF DEBUG ===');
      console.log('branchToUse:', branchToUse);
      console.log('forkInfo:', JSON.stringify(forkInfo, null, 2));
      console.log('remoteInfo:', JSON.stringify(remoteInfo, null, 2));

      if (forkInfo.needsFork && forkInfo.forkOwner && forkInfo.forkUrl) {
        // For cross-fork PRs, head ref format is "owner:branch"
        headRef = `${forkInfo.forkOwner}:${branchToUse}`;

        console.log(`Setting up fork workflow for ${forkInfo.forkOwner}/${forkInfo.forkRepo}`);
        console.log(`Head ref will be: ${headRef}`);

        // Check current remotes
        const remotes = await git.listRemotes({ dir: projectPath });
        console.log('Current remotes:', remotes);

        const originRemote = remotes.find(r => r.remote === 'origin');
        const forkRemote = remotes.find(r => r.url === forkInfo.forkUrl);

        // Determine which remote to use for pushing
        let pushRemote = 'origin';

        if (originRemote?.url !== forkInfo.forkUrl) {
          // Origin doesn't point to the fork - need to set it up
          console.log('Origin does not point to fork, checking for fork remote');

          if (forkRemote) {
            pushRemote = forkRemote.remote;
            console.log(`Using existing remote '${pushRemote}' for fork`);
          } else {
            // Add fork as a new remote
            console.log('Adding fork as new remote: fork');
            try {
              await git.addRemote({
                dir: projectPath,
                remote: 'fork',
                url: forkInfo.forkUrl,
              });
              pushRemote = 'fork';
            } catch (addRemoteError) {
              console.error('Failed to add fork remote:', addRemoteError);
              // Continue anyway, might already exist
              pushRemote = 'fork';
            }
          }
        }

        // Push the current branch to the fork
        console.log(`Pushing branch ${branchToUse} to ${pushRemote} (${forkInfo.forkUrl})`);

        try {
          await git.push({
            dir: projectPath,
            remote: pushRemote,
            ref: branchToUse,
            onAuth: () => credentials,
          });
          console.log('Successfully pushed to fork');
        } catch (pushError) {
          console.error('Failed to push to fork:', pushError);
          const errorMsg = pushError instanceof Error ? pushError.message : 'Unknown error';
          throw new Error(
            `Failed to push branch '${branchToUse}' to your fork at ${forkInfo.forkUrl}.\n\n` +
            `This usually means:\n` +
            `1. The branch hasn't been committed yet\n` +
            `2. Network/authentication issues\n` +
            `3. The fork URL is incorrect\n\n` +
            `Error details: ${errorMsg}\n\n` +
            `Try pushing manually first, then create the PR.`
          );
        }
      }

      // Create PR based on platform
      console.log(`Creating ${remoteInfo.platform} PR...`);
      if (remoteInfo.platform === 'github') {
        const prUrl = await createGitHubPR(remoteInfo, credentials.password, headRef);
        setCreatedPrUrl(prUrl);
      } else if (remoteInfo.platform === 'gitlab') {
        const prUrl = await createGitLabMR(remoteInfo, credentials.password);
        setCreatedPrUrl(prUrl);
      }

      toast({
        title: 'Pull request created',
        description: 'Successfully created pull request',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast({
        title: 'Failed to create pull request',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const checkPushPermissions = async (info: RemoteInfo, token: string): Promise<boolean> => {
    try {
      const url = info.platform === 'github'
        ? `${info.apiUrl}/repos/${info.owner}/${info.repo}`
        : `${info.apiUrl}/projects/${encodeURIComponent(`${info.owner}/${info.repo}`)}`;

      const headers = info.platform === 'github'
        ? { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
        : { 'PRIVATE-TOKEN': token };

      const response = await fetch(url, { headers });
      if (!response.ok) return false;

      const data = await response.json();

      if (info.platform === 'github') {
        return data.permissions?.push === true || data.permissions?.admin === true;
      } else {
        // GitLab uses access levels
        const accessLevel = data.permissions?.project_access?.access_level || 0;
        return accessLevel >= 30; // Developer (30), Maintainer (40), or Owner (50)
      }
    } catch {
      return false;
    }
  };

  const ensureFork = async (info: RemoteInfo, token: string): Promise<{ owner: string; repo: string; url: string }> => {
    console.log('=== ENSURE FORK ===');
    console.log('Repository:', `${info.owner}/${info.repo}`);

    // First check if fork already exists
    const user = await getCurrentUser(info, token);
    console.log('Current user:', user.username);

    const existingFork = await checkForkExists(info, token, user.username);

    if (existingFork) {
      console.log('Found existing fork:', existingFork);
      return existingFork;
    }

    // Create fork
    console.log('No existing fork found, creating new fork...');
    const fork = await createFork(info, token);
    console.log('Fork created:', fork);

    // Wait a bit for fork to be ready
    console.log('Waiting 2 seconds for fork to be ready...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    return fork;
  };

  const getCurrentUser = async (info: RemoteInfo, token: string): Promise<{ username: string }> => {
    const url = info.platform === 'github' ? `${info.apiUrl}/user` : `${info.apiUrl}/user`;
    const headers = info.platform === 'github'
      ? { 'Authorization': `token ${token}` }
      : { 'PRIVATE-TOKEN': token };

    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error('Failed to get current user');

    const data = await response.json();
    return { username: info.platform === 'github' ? data.login : data.username };
  };

  const checkForkExists = async (
    info: RemoteInfo,
    token: string,
    username: string
  ): Promise<{ owner: string; repo: string; url: string } | null> => {
    try {
      const url = info.platform === 'github'
        ? `${info.apiUrl}/repos/${username}/${info.repo}`
        : `${info.apiUrl}/projects/${encodeURIComponent(`${username}/${info.repo}`)}`;

      const headers = info.platform === 'github'
        ? { 'Authorization': `token ${token}` }
        : { 'PRIVATE-TOKEN': token };

      const response = await fetch(url, { headers });
      if (!response.ok) return null;

      const data = await response.json();

      // Verify it's actually a fork of the upstream repo
      const isFork = info.platform === 'github'
        ? data.fork && data.parent?.full_name === `${info.owner}/${info.repo}`
        : data.forked_from_project?.path_with_namespace === `${info.owner}/${info.repo}`;

      if (isFork) {
        return {
          owner: username,
          repo: info.repo,
          url: data.clone_url || data.http_url_to_repo,
        };
      }
    } catch {
      return null;
    }
    return null;
  };

  const createFork = async (info: RemoteInfo, token: string): Promise<{ owner: string; repo: string; url: string }> => {
    const url = info.platform === 'github'
      ? `${info.apiUrl}/repos/${info.owner}/${info.repo}/forks`
      : `${info.apiUrl}/projects/${encodeURIComponent(`${info.owner}/${info.repo}`)}/fork`;

    const headers = info.platform === 'github'
      ? { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' }
      : { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' };

    const response = await fetch(url, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create fork: ${errorText}`);
    }

    const data = await response.json();
    const owner = info.platform === 'github' ? data.owner.login : data.namespace.path;

    return {
      owner,
      repo: info.repo,
      url: data.clone_url || data.http_url_to_repo,
    };
  };

  const createGitHubPR = async (info: RemoteInfo, token: string, headRef: string): Promise<string> => {
    const url = `${info.apiUrl}/repos/${info.owner}/${info.repo}/pulls`;

    const requestBody = {
      title,
      body: description,
      head: headRef,
      base: targetBranch,
      maintainer_can_modify: true,
    };

    console.log('=== CREATING GITHUB PR ===');
    console.log('URL:', url);
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    console.log('Token length:', token?.length);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('GitHub response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub API error response:', errorText);

      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { message: errorText || 'Unknown error' };
      }

      // GitHub validation errors often include detailed field-specific messages
      let errorMessage = error.message || `GitHub API error: ${response.status} - ${response.statusText}`;

      if (error.errors && Array.isArray(error.errors)) {
        const errorDetails = error.errors.map((e: any) => {
          if (e.message) return e.message;
          if (e.field && e.code) return `${e.field}: ${e.code}`;
          return JSON.stringify(e);
        }).join('; ');
        errorMessage = `${errorMessage}\nDetails: ${errorDetails}`;
      }

      if (error.documentation_url) {
        errorMessage = `${errorMessage}\nSee: ${error.documentation_url}`;
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('GitHub PR created:', data.html_url);
    return data.html_url;
  };

  const createGitLabMR = async (info: RemoteInfo, token: string): Promise<string> => {
    // Get project ID first
    const projectUrl = `${info.apiUrl}/projects/${encodeURIComponent(`${info.owner}/${info.repo}`)}`;
    console.log('GitLab project URL:', projectUrl);
    console.log('Using token (first 10 chars):', token.substring(0, 10) + '...');

    const projectResponse = await fetch(projectUrl, {
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json',
      },
    });

    console.log('GitLab project response status:', projectResponse.status);

    if (!projectResponse.ok) {
      const errorText = await projectResponse.text();
      console.error('GitLab project error response:', errorText);
      throw new Error(`Failed to get GitLab project: ${projectResponse.status} - ${errorText}`);
    }

    const project = await projectResponse.json();
    console.log('GitLab project ID:', project.id);

    // Create merge request
    const mrUrl = `${info.apiUrl}/projects/${project.id}/merge_requests`;
    console.log('GitLab MR URL:', mrUrl);
    console.log('GitLab MR data:', { source_branch: currentBranch, target_branch: targetBranch, title, description });

    const response = await fetch(mrUrl, {
      method: 'POST',
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_branch: currentBranch,
        target_branch: targetBranch,
        title,
        description,
      }),
    });

    console.log('GitLab MR response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitLab MR error response:', errorText);

      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { message: errorText || 'Unknown error' };
      }

      throw new Error(error.message || `GitLab API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    console.log('GitLab MR created:', data.web_url);
    return data.web_url;
  };

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen);
    onOpenChange?.(newOpen);

    // Reset form when closing
    if (!newOpen) {
      setTitle('');
      setDescription('');
      setCreatedPrUrl(null);
      setError(null);
    }
  };

  if (!remoteUrl) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <GitPullRequest className="h-4 w-4" />
          Create Pull Request
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitPullRequest className="h-5 w-5" />
            Create Pull Request
          </DialogTitle>
          <DialogDescription>
            Create a pull request to merge your changes
          </DialogDescription>
        </DialogHeader>

        {createdPrUrl ? (
          // Success state
          <div className="py-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Pull Request Created!</h3>
              <p className="text-muted-foreground">
                Your pull request has been created successfully
              </p>
            </div>
            <Button
              onClick={() => window.open(createdPrUrl, '_blank')}
              className="gap-2"
            >
              View Pull Request
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          // Form
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 pr-4">
              {/* Fork info */}
              {isCheckingPermissions && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription>Checking repository permissions...</AlertDescription>
                </Alert>
              )}

              {forkInfo.needsFork && forkInfo.forkOwner && (
                <Alert>
                  <AlertDescription>
                    You don't have push access to this repository. Your changes will be pushed to your fork at <strong>{forkInfo.forkOwner}/{forkInfo.forkRepo}</strong> and a pull request will be created from there.
                  </AlertDescription>
                </Alert>
              )}

              {/* Auto-branch creation notice */}
              {currentBranch && (currentBranch === 'main' || currentBranch === 'master') && (
                <Alert>
                  <AlertDescription>
                    You're on the <strong>{currentBranch}</strong> branch. A feature branch will be automatically created from your PR title for this contribution.
                  </AlertDescription>
                </Alert>
              )}

              {/* Branch comparison */}
              {currentBranch && (
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="font-mono">
                      {targetBranch}
                    </Badge>
                    <GitCompare className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline" className="font-mono">
                      {currentBranch}
                      {(currentBranch === 'main' || currentBranch === 'master') && ' (will create new branch)'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {forkInfo.needsFork
                      ? `From your fork to ${remoteInfo?.owner}/${remoteInfo?.repo}:${targetBranch}`
                      : `Merge ${currentBranch} into ${targetBranch}`
                    }
                  </p>
                  {(currentBranch === 'main' || currentBranch === 'master') && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      ℹ️ Feature branch will be auto-generated from PR title
                    </p>
                  )}
                </div>
              )}

              {/* Error alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
                </Alert>
              )}

              {/* Target branch selection */}
              <div className="space-y-2">
                <Label htmlFor="target-branch">Target Branch</Label>
                <Select
                  value={targetBranch}
                  onValueChange={setTargetBranch}
                  disabled={isLoadingBranches || isCreating}
                >
                  <SelectTrigger id="target-branch">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {remoteBranches.map((branch) => (
                      <SelectItem key={branch} value={branch}>
                        {branch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The branch you want to merge your changes into
                </p>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="pr-title">Title *</Label>
                <Input
                  id="pr-title"
                  placeholder="Brief description of your changes"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isCreating}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="pr-description">Description</Label>
                <Textarea
                  id="pr-description"
                  placeholder="Provide more details about your changes (supports Markdown)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={8}
                  disabled={isCreating}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Markdown formatting is supported
                </p>
              </div>

              {/* Repository info */}
              {remoteInfo && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Repository:</span>
                      <span className="font-medium">
                        {remoteInfo.owner}/{remoteInfo.repo}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Platform:</span>
                      <Badge variant="outline" className="capitalize">
                        {remoteInfo.platform}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {!createdPrUrl && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button onClick={createPullRequest} disabled={isCreating || !currentBranch || isCheckingPermissions}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {forkInfo.needsFork ? 'Creating fork & PR...' : 'Creating...'}
                </>
              ) : (
                <>
                  {forkInfo.needsFork ? (
                    <>
                      <GitFork className="h-4 w-4 mr-2" />
                      Fork & Create PR
                    </>
                  ) : (
                    <>
                      <GitPullRequest className="h-4 w-4 mr-2" />
                      Create Pull Request
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
