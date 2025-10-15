import { useQuery } from '@tanstack/react-query';
import { useGitSettings } from '@/hooks/useGitSettings';
import { findCredentialsForRepo } from '@/lib/gitCredentials';

interface PullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  author: string;
  url: string;
  createdAt: string;
  sourceBranch: string;
  targetBranch: string;
}

interface RemoteInfo {
  owner: string;
  repo: string;
  platform: 'github' | 'gitlab';
  apiUrl: string;
}

function parseRemoteUrl(url: string): RemoteInfo | null {
  try {
    // Normalize URL - remove .git suffix if present
    const normalizedUrl = url.replace(/\.git$/, '');
    let match;
    let owner = '';
    let repo = '';
    let platform: 'github' | 'gitlab' = 'github';
    let apiUrl = '';

    // GitHub SSH: git@github.com:owner/repo
    match = normalizedUrl.match(/git@github\.com:([^/]+)\/(.+)$/);
    if (match) {
      owner = match[1];
      repo = match[2];
      platform = 'github';
      apiUrl = 'https://api.github.com';
    }

    // GitHub HTTPS: https://github.com/owner/repo
    if (!match) {
      match = normalizedUrl.match(/https?:\/\/github\.com\/([^/]+)\/(.+)$/);
      if (match) {
        owner = match[1];
        repo = match[2];
        platform = 'github';
        apiUrl = 'https://api.github.com';
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
      }
    }

    if (owner && repo) {
      return { owner, repo, platform, apiUrl };
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchGitHubPRs(info: RemoteInfo, token?: string): Promise<PullRequest[]> {
  // First get the current user if we have a token
  let currentUsername: string | null = null;

  if (token) {
    try {
      const userResponse = await fetch(`${info.apiUrl}/user`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        currentUsername = userData.login;
      }
    } catch (error) {
      console.warn('Failed to fetch current GitHub user:', error);
    }
  }

  const url = `${info.apiUrl}/repos/${info.owner}/${info.repo}/pulls?state=open`;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };

  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub PRs: ${response.status}`);
  }

  const data = await response.json();

  const allPRs = data.map((pr: any) => ({
    id: pr.id,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    author: pr.user.login,
    url: pr.html_url,
    createdAt: pr.created_at,
    sourceBranch: pr.head.ref,
    targetBranch: pr.base.ref,
  }));

  // Filter to only show PRs created by the current user
  if (currentUsername) {
    return allPRs.filter((pr: PullRequest) => pr.author === currentUsername);
  }

  // If no token/username, return empty array (can't determine which PRs are theirs)
  return [];
}

async function fetchGitLabMRs(info: RemoteInfo, token?: string): Promise<PullRequest[]> {
  // First get the current user if we have a token
  let currentUsername: string | null = null;

  if (token) {
    try {
      const userResponse = await fetch(`${info.apiUrl}/user`, {
        headers: {
          'PRIVATE-TOKEN': token,
        },
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        currentUsername = userData.username;
      }
    } catch (error) {
      console.warn('Failed to fetch current GitLab user:', error);
    }
  }

  // Get project ID first
  const projectUrl = `${info.apiUrl}/projects/${encodeURIComponent(`${info.owner}/${info.repo}`)}`;
  const projectHeaders: Record<string, string> = {};

  if (token) {
    projectHeaders['PRIVATE-TOKEN'] = token;
  }

  const projectResponse = await fetch(projectUrl, { headers: projectHeaders });

  if (!projectResponse.ok) {
    throw new Error(`Failed to fetch GitLab project: ${projectResponse.status}`);
  }

  const project = await projectResponse.json();

  // Fetch merge requests
  const mrUrl = `${info.apiUrl}/projects/${project.id}/merge_requests?state=opened`;
  const mrHeaders: Record<string, string> = {};

  if (token) {
    mrHeaders['PRIVATE-TOKEN'] = token;
  }

  const response = await fetch(mrUrl, { headers: mrHeaders });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitLab MRs: ${response.status}`);
  }

  const data = await response.json();

  const allMRs = data.map((mr: any) => ({
    id: mr.id,
    number: mr.iid,
    title: mr.title,
    state: mr.state === 'opened' ? 'open' : mr.state,
    author: mr.author.username,
    url: mr.web_url,
    createdAt: mr.created_at,
    sourceBranch: mr.source_branch,
    targetBranch: mr.target_branch,
  }));

  // Filter to only show MRs created by the current user
  if (currentUsername) {
    return allMRs.filter((mr: PullRequest) => mr.author === currentUsername);
  }

  // If no token/username, return empty array (can't determine which MRs are theirs)
  return [];
}

export function usePullRequests(remoteUrl?: string) {
  const { settings } = useGitSettings();

  return useQuery({
    queryKey: ['pull-requests', remoteUrl],
    queryFn: async ({ signal }) => {
      if (!remoteUrl) {
        return [];
      }

      const remoteInfo = parseRemoteUrl(remoteUrl);
      if (!remoteInfo) {
        throw new Error('Invalid remote URL format');
      }

      // Get credentials if available
      const credentials = findCredentialsForRepo(remoteUrl, settings.credentials);
      const token = credentials?.password;

      // Fetch PRs based on platform
      if (remoteInfo.platform === 'github') {
        return await fetchGitHubPRs(remoteInfo, token);
      } else {
        return await fetchGitLabMRs(remoteInfo, token);
      }
    },
    enabled: !!remoteUrl,
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  });
}
