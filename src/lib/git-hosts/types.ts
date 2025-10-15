/**
 * Git host provider abstraction for PR/MR operations
 */

export interface GitHostUser {
  username: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
}

export interface GitRepository {
  owner: string;
  name: string;
  fullName: string; // e.g. "owner/repo"
  defaultBranch: string;
  cloneUrl: string;
  webUrl: string;
  description?: string;
  isPrivate: boolean;
}

export interface GitFork {
  owner: string;
  name: string;
  fullName: string;
  cloneUrl: string;
  webUrl: string;
  parentFullName: string; // The upstream repo
}

export interface PullRequest {
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed' | 'merged';
  headBranch: string;
  baseBranch: string;
  headRepo: string; // Full name of head repo (fork)
  baseRepo: string; // Full name of base repo (upstream)
  url: string;
  createdAt: Date;
  updatedAt: Date;
  author: string;
  mergeable?: boolean;
  checks?: PullRequestCheck[];
}

export interface PullRequestCheck {
  name: string;
  status: 'pending' | 'success' | 'failure' | 'cancelled';
  conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required';
  detailsUrl?: string;
}

export interface CreatePullRequestOptions {
  title: string;
  body?: string;
  headBranch: string;
  baseBranch: string;
  headRepo: string; // For cross-repo PRs (from fork)
  baseRepo: string; // The upstream repo
  maintainerCanModify?: boolean;
}

export interface GitHostConfig {
  token: string;
  username?: string;
}

/**
 * Abstract interface for Git hosting providers (GitHub, GitLab, Gitea, etc.)
 */
export interface GitHostProvider {
  readonly name: string;
  readonly apiBaseUrl: string;

  // Repository operations
  getRepository(owner: string, repo: string): Promise<GitRepository>;
  canUserPush(owner: string, repo: string): Promise<boolean>;

  // Fork operations
  createFork(owner: string, repo: string): Promise<GitFork>;
  getFork(upstreamOwner: string, upstreamRepo: string, username: string): Promise<GitFork | null>;
  waitForFork(upstreamOwner: string, upstreamRepo: string, username: string, timeout?: number): Promise<GitFork>;

  // Pull request operations
  createPullRequest(options: CreatePullRequestOptions): Promise<PullRequest>;
  getPullRequest(owner: string, repo: string, number: number): Promise<PullRequest>;
  listPullRequests(owner: string, repo: string, state?: 'open' | 'closed' | 'all'): Promise<PullRequest[]>;
  updatePullRequest(owner: string, repo: string, number: number, options: { title?: string; body?: string }): Promise<PullRequest>;
  closePullRequest(owner: string, repo: string, number: number): Promise<PullRequest>;

  // User operations
  getCurrentUser(): Promise<GitHostUser>;

  // Utility
  getCompareUrl(baseRepo: string, baseBranch: string, headRepo: string, headBranch: string): string;
}

/**
 * Detect Git host from repository URL
 */
export function detectGitHost(url: string): 'github' | 'gitlab' | 'gitea' | 'codeberg' | 'unknown' {
  try {
    const parsed = new URL(url.replace(/^git@/, 'https://').replace(/\.git$/, ''));
    const hostname = parsed.hostname.toLowerCase();

    if (hostname === 'github.com') return 'github';
    if (hostname === 'gitlab.com') return 'gitlab';
    if (hostname === 'codeberg.org') return 'codeberg';
    if (hostname.includes('gitea')) return 'gitea';

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Parse repository owner and name from URL
 */
export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    // Handle git@ URLs
    const normalized = url.replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '');
    const parsed = new URL(normalized);
    const parts = parsed.pathname.split('/').filter(Boolean);

    if (parts.length >= 2) {
      return {
        owner: parts[0],
        repo: parts[1],
      };
    }
  } catch {
    // Invalid URL
  }

  return null;
}

/**
 * Format repository URL for display
 */
export function formatRepoUrl(url: string): string {
  const parsed = parseRepoUrl(url);
  if (parsed) {
    return `${parsed.owner}/${parsed.repo}`;
  }
  return url;
}
