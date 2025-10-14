import { useState, useEffect } from 'react';
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
import { cn } from '@/lib/utils';
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

  useEffect(() => {
    if (isOpen && remoteUrl) {
      parseRemoteUrl(remoteUrl);
      loadRemoteBranches();
    }
  }, [isOpen, remoteUrl]);

  const parseRemoteUrl = (url: string) => {
    setError(null);
    try {
      // Parse GitHub/GitLab URLs
      let match;
      let owner = '';
      let repo = '';
      let platform: 'github' | 'gitlab' = 'github';
      let apiUrl = '';

      // GitHub SSH: git@github.com:owner/repo.git
      match = url.match(/git@github\.com:([^/]+)\/(.+?)(\.git)?$/);
      if (match) {
        owner = match[1];
        repo = match[2];
        platform = 'github';
        apiUrl = 'https://api.github.com';
      }

      // GitHub HTTPS: https://github.com/owner/repo.git
      if (!match) {
        match = url.match(/https:\/\/github\.com\/([^/]+)\/(.+?)(\.git)?$/);
        if (match) {
          owner = match[1];
          repo = match[2];
          platform = 'github';
          apiUrl = 'https://api.github.com';
        }
      }

      // GitLab SSH: git@gitlab.com:owner/repo.git
      if (!match) {
        match = url.match(/git@gitlab\.com:([^/]+)\/(.+?)(\.git)?$/);
        if (match) {
          owner = match[1];
          repo = match[2];
          platform = 'gitlab';
          apiUrl = 'https://gitlab.com/api/v4';
        }
      }

      // GitLab HTTPS: https://gitlab.com/owner/repo.git
      if (!match) {
        match = url.match(/https:\/\/gitlab\.com\/([^/]+)\/(.+?)(\.git)?$/);
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
        setError('Unsupported remote URL. Only GitHub and GitLab are supported.');
      }
    } catch (err) {
      setError('Failed to parse remote URL');
    }
  };

  const loadRemoteBranches = async () => {
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
      // Get credentials
      const credentials = findCredentialsForRepo(remoteUrl || '', settings.credentials);
      if (!credentials) {
        throw new Error(
          `No credentials found for ${remoteInfo.platform}. Please add credentials in Settings > Git.`
        );
      }

      // Create PR based on platform
      if (remoteInfo.platform === 'github') {
        const prUrl = await createGitHubPR(remoteInfo, credentials.token);
        setCreatedPrUrl(prUrl);
      } else if (remoteInfo.platform === 'gitlab') {
        const prUrl = await createGitLabMR(remoteInfo, credentials.token);
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
    const response = await fetch(`${info.apiUrl}/repos/${info.owner}/${info.repo}/pulls`, {
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

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    return data.html_url;
  };

  const createGitLabMR = async (info: RemoteInfo, token: string): Promise<string> => {
    // Get project ID first
    const projectResponse = await fetch(
      `${info.apiUrl}/projects/${encodeURIComponent(`${info.owner}/${info.repo}`)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!projectResponse.ok) {
      throw new Error(`Failed to get GitLab project: ${projectResponse.status}`);
    }

    const project = await projectResponse.json();

    // Create merge request
    const response = await fetch(`${info.apiUrl}/projects/${project.id}/merge_requests`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_branch: currentBranch,
        target_branch: targetBranch,
        title,
        description,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `GitLab API error: ${response.status}`);
    }

    const data = await response.json();
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
