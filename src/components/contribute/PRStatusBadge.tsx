import { useEffect, useState } from 'react';
import { useGit } from '@/hooks/useGit';
import { useGitSettings } from '@/hooks/useGitSettings';
import { useAppContext } from '@/hooks/useAppContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { createGitHostProvider, parseRepoUrl } from '@/lib/git-hosts';
import { ExternalLink, GitPullRequest, CheckCircle2, XCircle, GitMerge } from 'lucide-react';
import type { PullRequest } from '@/lib/git-hosts';

interface PRStatusBadgeProps {
  projectDir: string;
}

export function PRStatusBadge({ projectDir }: PRStatusBadgeProps) {
  const { git } = useGit();
  const { settings } = useGitSettings();
  const { config } = useAppContext();
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadPRs = async () => {
      setLoading(true);
      try {
        // Get the current branch
        const currentBranch = await git.currentBranch({ dir: projectDir });
        if (!currentBranch) return;

        // Get remote URL
        const upstreamUrl = await git.getRemoteURL(projectDir, 'upstream');
        const originUrl = await git.getRemoteURL(projectDir, 'origin');
        const remoteUrl = upstreamUrl || originUrl;

        if (!remoteUrl) return;

        const parsed = parseRepoUrl(remoteUrl);
        if (!parsed) return;

        const hostname = new URL(remoteUrl.replace(/^git@/, 'https://').replace(/\.git$/, '')).hostname;
        const hostToken = settings.hostTokens[hostname];

        if (!hostToken) return;

        const provider = createGitHostProvider(remoteUrl, { token: hostToken.token }, config.corsProxy);
        if (!provider) return;

        // List open PRs for this repo
        const allPrs = await provider.listPullRequests(parsed.owner, parsed.repo, 'open');
        
        // Filter PRs that match the current branch
        const relevantPrs = allPrs.filter(pr => pr.headBranch === currentBranch);
        setPrs(relevantPrs);
      } catch (error) {
        console.error('Failed to load PRs:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPRs();
  }, [git, projectDir, settings.hostTokens, config.corsProxy]);

  if (loading || prs.length === 0) {
    return null;
  }

  const pr = prs[0]; // Show the first matching PR

  const getStateIcon = () => {
    switch (pr.state) {
      case 'open':
        return <GitPullRequest className="h-3 w-3" />;
      case 'merged':
        return <GitMerge className="h-3 w-3" />;
      case 'closed':
        return <XCircle className="h-3 w-3" />;
      default:
        return <GitPullRequest className="h-3 w-3" />;
    }
  };

  const getStateColor = () => {
    switch (pr.state) {
      case 'open':
        return 'default';
      case 'merged':
        return 'secondary';
      case 'closed':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge variant={getStateColor()} className="cursor-pointer gap-1">
          {getStateIcon()}
          PR #{pr.number}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium text-sm leading-tight">{pr.title}</h4>
              <Badge variant={getStateColor()} className="shrink-0">
                {pr.state}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              #{pr.number} opened by {pr.author}
            </p>
          </div>

          {pr.body && (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {pr.body}
            </p>
          )}

          {pr.checks && pr.checks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium">Checks</p>
              {pr.checks.map((check, index) => (
                <div key={index} className="flex items-center gap-2 text-xs">
                  {check.status === 'success' ? (
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                  ) : check.status === 'failure' ? (
                    <XCircle className="h-3 w-3 text-red-600" />
                  ) : (
                    <div className="h-3 w-3 rounded-full border-2 border-muted-foreground animate-spin" />
                  )}
                  <span>{check.name}</span>
                </div>
              ))}
            </div>
          )}

          <Button variant="outline" size="sm" className="w-full" asChild>
            <a href={pr.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 mr-2" />
              View Pull Request
            </a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
