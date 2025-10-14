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

      // Create PR based on platform
      console.log(`Creating ${remoteInfo.platform} PR...`);
      if (remoteInfo.platform === 'github') {
        const prUrl = await createGitHubPR(remoteInfo, credentials.password);
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

  const createGitHubPR = async (info: RemoteInfo, token: string): Promise<string> => {
    const url = `${info.apiUrl}/repos/${info.owner}/${info.repo}/pulls`;
    console.log('GitHub PR URL:', url);
    console.log('GitHub PR data:', { title, body: description, head: currentBranch, base: targetBranch });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        title,
        body: description,
        head: currentBranch,
        base: targetBranch,
      }),
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

      throw new Error(error.message || `GitHub API error: ${response.status} - ${response.statusText}`);
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
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Merge {currentBranch} into {targetBranch}
                  </p>
                </div>
              )}

              {/* Error alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
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
            <Button onClick={createPullRequest} disabled={isCreating || !currentBranch}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <GitPullRequest className="h-4 w-4 mr-2" />
                  Create Pull Request
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
