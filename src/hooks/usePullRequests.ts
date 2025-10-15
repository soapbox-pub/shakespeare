import { useQuery } from '@tanstack/react-query';
import { useGitSettings } from '@/hooks/useGitSettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostr } from '@nostrify/react';
import { findCredentialsForRepo } from '@/lib/gitCredentials';
import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';

interface PullRequest {
  id: number | string;
  number: number | string;
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
  platform: 'github' | 'gitlab' | 'nostr';
  apiUrl: string;
}

function parseRemoteUrl(url: string): RemoteInfo | null {
  try {
    // Nostr git: nostr://<pubkey>/<repo-id>
    if (url.startsWith('nostr://')) {
      const match = url.match(/^nostr:\/\/([^/]+)\/(.+)$/);
      if (match) {
        let pubkeyOrNpub = match[1];
        const repo = match[2];

        // Convert npub to hex if needed
        let owner = pubkeyOrNpub;
        if (pubkeyOrNpub.startsWith('npub1')) {
          try {
            const decoded = nip19.decode(pubkeyOrNpub);
            if (decoded.type === 'npub') {
              owner = decoded.data; // hex pubkey
            }
          } catch (err) {
            console.error('Failed to decode npub:', err);
            return null;
          }
        }

        return { owner, repo, platform: 'nostr', apiUrl: '' };
      }
    }

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

async function fetchNostrPatches(
  info: RemoteInfo,
  currentUserPubkey: string | undefined,
  nostr: any,
  signal: AbortSignal
): Promise<PullRequest[]> {
  console.log('=== FETCHING NOSTR PATCHES ===');
  console.log('Repository:', `${info.owner}/${info.repo}`);
  console.log('Current user pubkey:', currentUserPubkey);

  if (!currentUserPubkey) {
    console.log('No current user, returning empty array');
    return [];
  }

  try {
    // Query for patches (kind 1617) for this repository created by current user
    console.log('Querying patches with filter:', {
      kinds: [1617],
      authors: [currentUserPubkey],
      '#a': [`30617:${info.owner}:${info.repo}`],
    });

    const patches = await nostr.query([
      {
        kinds: [1617],
        authors: [currentUserPubkey],
        '#a': [`30617:${info.owner}:${info.repo}`],
        limit: 50,
      }
    ], { signal });

    console.log(`Found ${patches.length} patches for current user`);

    if (patches.length > 0) {
      console.log('Sample patch:', patches[0]);
    }

    // Convert Nostr patches to PullRequest format
    const pullRequests: PullRequest[] = patches.map((patch: NostrEvent) => {
      const subject = patch.tags.find(t => t[0] === 'subject')?.[1] || 'Untitled patch';

      // Check if it's a root patch (unmerged/open)
      const isRoot = patch.tags.some(t => t[0] === 't' && t[1] === 'root');

      // For now, assume all patches are open (we'd need to query status events to know if merged/closed)
      const state = 'open';

      // Extract source/target branches from content if available
      // Patch content format: "From: <branch>\nTo: <branch>..."
      const contentLines = patch.content.split('\n');
      let sourceBranch = 'unknown';
      let targetBranch = 'main';

      for (const line of contentLines) {
        if (line.startsWith('From:')) {
          sourceBranch = line.replace('From:', '').trim();
        }
        if (line.startsWith('To:')) {
          targetBranch = line.replace('To:', '').trim();
        }
      }

      return {
        id: patch.id,
        number: patch.id.slice(0, 8), // Use first 8 chars of event ID as number
        title: subject,
        state: state as 'open' | 'closed' | 'merged',
        author: nip19.npubEncode(patch.pubkey),
        url: `nostr:${patch.id}`, // Event reference
        createdAt: new Date(patch.created_at * 1000).toISOString(),
        sourceBranch,
        targetBranch,
      };
    });

    console.log('Converted patches to PRs:', pullRequests);

    return pullRequests;
  } catch (error) {
    console.error('Failed to fetch Nostr patches:', error);
    throw error;
  }
}

export function usePullRequests(remoteUrl?: string) {
  const { settings } = useGitSettings();
  const { user } = useCurrentUser();
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['pull-requests', remoteUrl, user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!remoteUrl) {
        return [];
      }

      const remoteInfo = parseRemoteUrl(remoteUrl);
      if (!remoteInfo) {
        throw new Error('Invalid remote URL format');
      }

      // Fetch PRs based on platform
      if (remoteInfo.platform === 'nostr') {
        return await fetchNostrPatches(remoteInfo, user?.pubkey, nostr, signal);
      } else if (remoteInfo.platform === 'github') {
        // Get credentials if available
        const credentials = findCredentialsForRepo(remoteUrl, settings.credentials);
        const token = credentials?.password;
        return await fetchGitHubPRs(remoteInfo, token);
      } else {
        // GitLab
        const credentials = findCredentialsForRepo(remoteUrl, settings.credentials);
        const token = credentials?.password;
        return await fetchGitLabMRs(remoteInfo, token);
      }
    },
    enabled: !!remoteUrl,
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  });
}
