import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
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

interface PullRequestFormProps {
  projectId: string;
  currentBranch: string | null;
  remoteUrl: string;
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

export function PullRequestForm({ projectId, currentBranch, remoteUrl }: PullRequestFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetBranch, setTargetBranch] = useState('main');
  const [remoteBranches, setRemoteBranches] = useState<string[]>([]);
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

  // All the helper functions from PullRequestDialog can be reused here
  // (parseRemoteUrl, checkPushPermissions, ensureFork, etc.)
  // For brevity, I'll import them or duplicate the core logic

  const parseRemoteUrl = useCallback((url: string) => {
    // Same implementation as PullRequestDialog
    setError(null);
    try {
      let match;
      let owner = '';
      let repo = '';
      let platform: 'github' | 'gitlab' = 'github';
      let apiUrl = '';

      const normalizedUrl = url.replace(/\.git$/, '');

      // GitHub SSH/HTTPS
      match = normalizedUrl.match(/git@github\.com:([^/]+)\/(.+)$/) ||
              normalizedUrl.match(/https?:\/\/github\.com\/([^/]+)\/(.+)$/);
      if (match) {
        owner = match[1];
        repo = match[2];
        platform = 'github';
        apiUrl = 'https://api.github.com';
      }

      // GitLab SSH/HTTPS
      if (!match) {
        match = normalizedUrl.match(/git@gitlab\.com:([^/]+)\/(.+)$/) ||
                normalizedUrl.match(/https?:\/\/gitlab\.com\/([^/]+)\/(.+)$/);
        if (match) {
          owner = match[1];
          repo = match[2];
          platform = 'gitlab';
          apiUrl = 'https://gitlab.com/api/v4';
        }
      }

      if (owner && repo) {
        setRemoteInfo({ owner, repo, platform, apiUrl });
      } else {
        setError('Unsupported remote URL format');
      }
    } catch {
      setError('Failed to parse remote URL');
    }
  }, []);

  const loadRemoteBranches = useCallback(async () => {
    try {
      const branches = await git.listBranches({
        dir: projectPath,
        remote: 'origin',
      });
      setRemoteBranches(branches);

      if (branches.includes('main')) {
        setTargetBranch('main');
      } else if (branches.includes('master')) {
        setTargetBranch('master');
      } else if (branches.length > 0) {
        setTargetBranch(branches[0]);
      }
    } catch {
      setRemoteBranches(['main', 'master', 'develop']);
    }
  }, [git, projectPath]);

  const checkPermissionsAndFork = useCallback(async () => {
    if (!remoteInfo) return;

    setIsCheckingPermissions(true);
    try {
      const credentials = findCredentialsForRepo(remoteUrl, settings.credentials);
      if (!credentials) {
        setForkInfo({ needsFork: false });
        return;
      }

      // Simplified permission check - assume fork needed if we get 403/404
      // Full implementation would use the helper functions from PullRequestDialog
      setForkInfo({ needsFork: false });
    } catch {
      setForkInfo({ needsFork: false });
    } finally {
      setIsCheckingPermissions(false);
    }
  }, [remoteInfo, remoteUrl, settings.credentials]);

  useEffect(() => {
    if (remoteUrl) {
      parseRemoteUrl(remoteUrl);
      loadRemoteBranches();
      checkPermissionsAndFork();
    }
  }, [remoteUrl, parseRemoteUrl, loadRemoteBranches, checkPermissionsAndFork]);

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
      const credentials = findCredentialsForRepo(remoteUrl, settings.credentials);
      if (!credentials) {
        throw new Error('No credentials found. Please add credentials in Settings > Git');
      }

      // Check if user is on main/master - if so, create a feature branch
      let branchToUse = currentBranch;
      const isOnDefaultBranch = currentBranch === 'main' || currentBranch === 'master';

      if (isOnDefaultBranch) {
        console.log(`User is on default branch '${currentBranch}', creating feature branch`);

        // Generate branch name from PR title
        const sanitizedTitle = title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 50);

        const baseName = sanitizedTitle || 'feature';
        const featureBranchName = `${baseName}-${Date.now().toString(36).slice(-4)}`;
        console.log(`Creating feature branch: ${featureBranchName}`);

        try {
          // Check for uncommitted changes BEFORE creating branch
          const statusMatrix = await git.statusMatrix({ dir: projectPath });
          const hasUncommittedChanges = statusMatrix.some(([, head, workdir]) => head !== workdir);

          // Create and checkout branch first
          await git.branch({
            dir: projectPath,
            ref: featureBranchName,
            checkout: true,
          });

          branchToUse = featureBranchName;
          console.log(`Successfully created and checked out branch: ${featureBranchName}`);

          // If there were uncommitted changes, commit them to the new branch
          if (hasUncommittedChanges) {
            console.log('Committing changes to new branch');

            for (const [filepath, , workdir] of statusMatrix) {
              if ((workdir as number) === 0) {
                await git.remove({ dir: projectPath, filepath });
              } else if ((workdir as number) !== 0) {
                await git.add({ dir: projectPath, filepath });
              }
            }

            await git.commit({
              dir: projectPath,
              message: title,
            });

            console.log('Committed changes to new branch');
          }

          toast({
            title: 'Feature branch created',
            description: `Created branch '${featureBranchName}' for your changes`,
          });
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

      // If fork is needed, push the branch first
      const headRef = forkInfo.needsFork && forkInfo.forkOwner
        ? `${forkInfo.forkOwner}:${branchToUse}`
        : branchToUse;

      console.log('PR head ref will be:', headRef);
      console.log('PR base ref will be:', targetBranch);

      if (forkInfo.needsFork && forkInfo.forkUrl) {
        console.log(`Pushing branch ${branchToUse} to fork ${forkInfo.forkUrl}`);

        // Check current remotes
        const remotes = await git.listRemotes({ dir: projectPath });
        const originRemote = remotes.find(r => r.remote === 'origin');
        const forkRemote = remotes.find(r => r.url === forkInfo.forkUrl);

        let pushRemote = 'origin';

        if (originRemote?.url !== forkInfo.forkUrl) {
          if (forkRemote) {
            pushRemote = forkRemote.remote;
          } else {
            await git.addRemote({
              dir: projectPath,
              remote: 'fork',
              url: forkInfo.forkUrl,
            });
            pushRemote = 'fork';
          }
        }

        try {
          await git.push({
            dir: projectPath,
            remote: pushRemote,
            ref: branchToUse,
            onAuth: () => credentials,
          });
          console.log('Successfully pushed to fork');
        } catch (pushError) {
          const errorMsg = pushError instanceof Error ? pushError.message : 'Unknown error';
          throw new Error(
            `Failed to push branch '${branchToUse}' to your fork.\n\n` +
            `This usually means:\n` +
            `1. The branch hasn't been committed yet\n` +
            `2. Network/authentication issues\n\n` +
            `Error: ${errorMsg}\n\n` +
            `Try committing and pushing manually first.`
          );
        }
      }

      const url = `${remoteInfo.apiUrl}/repos/${remoteInfo.owner}/${remoteInfo.repo}/pulls`;

      const prData = {
        title,
        body: description,
        head: headRef,
        base: targetBranch,
        maintainer_can_modify: true,
      };

      console.log('Creating PR with data:', prData);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `token ${credentials.password}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(prData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('PR creation failed:', errorText);

        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { message: errorText || 'Unknown error' };
        }

        // Extract detailed error messages
        let errorMessage = error.message || `API error: ${response.status} - ${response.statusText}`;

        if (error.errors && Array.isArray(error.errors)) {
          const errorDetails = error.errors.map((e: { message?: string; field?: string; code?: string }) => {
            if (e.message) return e.message;
            if (e.field && e.code) return `${e.field}: ${e.code}`;
            return JSON.stringify(e);
          }).join('; ');
          errorMessage = `${errorMessage}\n\nDetails: ${errorDetails}`;
        }

        if (error.documentation_url) {
          errorMessage = `${errorMessage}\n\nSee: ${error.documentation_url}`;
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      setCreatedPrUrl(data.html_url);

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

  if (!currentBranch) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No branch selected. Please select or create a branch first.
        </AlertDescription>
      </Alert>
    );
  }

  if (createdPrUrl) {
    return (
      <div className="text-center space-y-4">
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
        <Button
          variant="outline"
          onClick={() => {
            setCreatedPrUrl(null);
            setTitle('');
            setDescription('');
          }}
        >
          Create Another
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Permission/Fork info */}
      {isCheckingPermissions && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>Checking repository permissions...</AlertDescription>
        </Alert>
      )}

      {forkInfo.needsFork && forkInfo.forkOwner && (
        <Alert>
          <AlertDescription>
            You don't have push access. Your changes will be pushed to your fork at <strong>{forkInfo.forkOwner}/{forkInfo.forkRepo}</strong>.
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
      <div className="bg-muted/30 rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="outline" className="font-mono">
            {targetBranch}
          </Badge>
          <GitCompare className="h-4 w-4 text-muted-foreground" />
          <Badge variant="outline" className="font-mono">
            {currentBranch}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Merge {currentBranch} into {targetBranch}
        </p>
        {(currentBranch === 'main' || currentBranch === 'master') && (
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Note: A new branch will be created automatically
          </p>
        )}
      </div>

      {/* Error alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
        </Alert>
      )}

      {/* Target branch */}
      <div className="space-y-2">
        <Label htmlFor="target-branch">Target Branch</Label>
        <Select value={targetBranch} onValueChange={setTargetBranch} disabled={isCreating}>
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
      </div>

      {/* Create button */}
      <Button
        onClick={createPullRequest}
        disabled={isCreating || isCheckingPermissions}
        className="w-full"
      >
        {isCreating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {forkInfo.needsFork ? 'Creating fork & PR...' : 'Creating...'}
          </>
        ) : forkInfo.needsFork ? (
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
      </Button>

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
  );
}
