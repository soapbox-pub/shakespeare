import { proxyUrl } from '../proxyUrl';
import type {
  GitHostProvider,
  GitHostConfig,
  GitRepository,
  GitFork,
  PullRequest,
  PullRequestCheck,
  CreatePullRequestOptions,
  GitHostUser,
} from './types';

interface GitHubPRResponse {
  id: number;
  number: number;
  state: string;
  title: string;
  body: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  user: { login: string };
  head: { ref: string; repo: { full_name: string } };
  base: { ref: string; repo: { full_name: string } };
  mergeable?: boolean;
  merged?: boolean;
}

export class GitHubProvider implements GitHostProvider {
  readonly name = 'GitHub';
  readonly apiBaseUrl = 'https://api.github.com';

  private config: GitHostConfig;
  private corsProxy?: string;

  constructor(config: GitHostConfig, corsProxy?: string) {
    this.config = config;
    this.corsProxy = corsProxy;
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.apiBaseUrl}${path}`;
    const targetUrl = this.corsProxy ? proxyUrl(this.corsProxy, url) : url;

    const response = await fetch(targetUrl, {
      ...options,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${this.config.token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  async getRepository(owner: string, repo: string): Promise<GitRepository> {
    interface GitHubRepo {
      owner: { login: string };
      name: string;
      full_name: string;
      default_branch: string;
      clone_url: string;
      html_url: string;
      description: string;
      private: boolean;
    }

    const data = await this.fetch<GitHubRepo>(`/repos/${owner}/${repo}`);

    return {
      owner: data.owner.login,
      name: data.name,
      fullName: data.full_name,
      defaultBranch: data.default_branch,
      cloneUrl: data.clone_url,
      webUrl: data.html_url,
      description: data.description,
      isPrivate: data.private,
    };
  }

  async canUserPush(owner: string, repo: string): Promise<boolean> {
    try {
      interface GitHubRepoWithPermissions {
        permissions?: { push?: boolean; admin?: boolean };
      }

      const data = await this.fetch<GitHubRepoWithPermissions>(`/repos/${owner}/${repo}`);
      return data.permissions?.push === true || data.permissions?.admin === true;
    } catch {
      // If we can't check permissions, assume no push access
      return false;
    }
  }

  async createFork(owner: string, repo: string): Promise<GitFork> {
    interface GitHubFork {
      owner: { login: string };
      name: string;
      clone_url: string;
      html_url: string;
    }

    const data = await this.fetch<GitHubFork>(`/repos/${owner}/${repo}/forks`, {
      method: 'POST',
    });

    return {
      owner: data.owner.login,
      name: data.name,
      fullName: `${data.owner.login}/${data.name}`,
      cloneUrl: data.clone_url,
      webUrl: data.html_url,
      parentFullName: `${owner}/${repo}`,
    };
  }

  async getFork(upstreamOwner: string, upstreamRepo: string, username: string): Promise<GitFork | null> {
    try {
      interface GitHubForkCheck {
        fork: boolean;
        owner: { login: string };
        name: string;
        full_name: string;
        clone_url: string;
        html_url: string;
        parent?: { full_name: string };
      }

      // Check if the fork already exists
      const data = await this.fetch<GitHubForkCheck>(`/repos/${username}/${upstreamRepo}`);

      // Verify it's actually a fork of the upstream repo
      if (data.fork && data.parent?.full_name === `${upstreamOwner}/${upstreamRepo}`) {
        return {
          owner: data.owner.login,
          name: data.name,
          fullName: data.full_name,
          cloneUrl: data.clone_url,
          webUrl: data.html_url,
          parentFullName: data.parent.full_name,
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  async waitForFork(
    upstreamOwner: string,
    upstreamRepo: string,
    username: string,
    timeout = 30000
  ): Promise<GitFork> {
    const startTime = Date.now();
    const pollInterval = 1000;

    while (Date.now() - startTime < timeout) {
      const fork = await this.getFork(upstreamOwner, upstreamRepo, username);
      if (fork) {
        return fork;
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Timeout waiting for fork to be created');
  }

  async createPullRequest(options: CreatePullRequestOptions): Promise<PullRequest> {
    const [baseOwner, baseRepo] = options.baseRepo.split('/');
    const [headOwner] = options.headRepo.split('/');

    // Format head ref for cross-repo PR
    const head = headOwner !== baseOwner
      ? `${headOwner}:${options.headBranch}`
      : options.headBranch;

    const data = await this.fetch<GitHubPRResponse>(`/repos/${baseOwner}/${baseRepo}/pulls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: options.title,
        body: options.body || '',
        head,
        base: options.baseBranch,
        maintainer_can_modify: options.maintainerCanModify ?? true,
      }),
    });

    return this.transformPullRequest(data);
  }

  async getPullRequest(owner: string, repo: string, number: number): Promise<PullRequest> {
    const data = await this.fetch<GitHubPRResponse>(`/repos/${owner}/${repo}/pulls/${number}`);
    return this.transformPullRequest(data);
  }

  async listPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open'
  ): Promise<PullRequest[]> {
    const data = await this.fetch<GitHubPRResponse[]>(`/repos/${owner}/${repo}/pulls?state=${state}`);
    return data.map(pr => this.transformPullRequest(pr));
  }

  async updatePullRequest(
    owner: string,
    repo: string,
    number: number,
    options: { title?: string; body?: string }
  ): Promise<PullRequest> {
    const data = await this.fetch<GitHubPRResponse>(`/repos/${owner}/${repo}/pulls/${number}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });

    return this.transformPullRequest(data);
  }

  async closePullRequest(owner: string, repo: string, number: number): Promise<PullRequest> {
    const data = await this.fetch<GitHubPRResponse>(`/repos/${owner}/${repo}/pulls/${number}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'closed' }),
    });

    return this.transformPullRequest(data);
  }

  async getCurrentUser(): Promise<GitHostUser> {
    interface GitHubUser {
      login: string;
      name: string;
      email: string;
      avatar_url: string;
    }

    const data = await this.fetch<GitHubUser>('/user');

    return {
      username: data.login,
      name: data.name,
      email: data.email,
      avatarUrl: data.avatar_url,
    };
  }

  getCompareUrl(baseRepo: string, baseBranch: string, headRepo: string, headBranch: string): string {
    const [headOwner, headRepoName] = headRepo.split('/');
    return `https://github.com/${baseRepo}/compare/${baseBranch}...${headOwner}:${headRepoName}:${headBranch}?expand=1`;
  }

  private transformPullRequest(data: {
    id: number;
    number: number;
    state: string;
    title: string;
    body: string;
    html_url: string;
    created_at: string;
    updated_at: string;
    user: { login: string };
    head: { ref: string; repo: { full_name: string } };
    base: { ref: string; repo: { full_name: string } };
    mergeable?: boolean;
    merged?: boolean;
  }): PullRequest {
    const state: 'open' | 'closed' | 'merged' = data.merged ? 'merged' : data.state as 'open' | 'closed';

    return {
      number: data.number,
      title: data.title,
      body: data.body,
      state,
      headBranch: data.head.ref,
      baseBranch: data.base.ref,
      headRepo: data.head.repo?.full_name || '',
      baseRepo: data.base.repo.full_name,
      url: data.html_url,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      author: data.user.login,
      mergeable: data.mergeable,
      checks: this.transformChecks(data),
    };
  }

  private transformChecks(_data: unknown): PullRequestCheck[] | undefined {
    // GitHub's check runs are in a separate API call, so we don't have them here
    // This would need a separate API call to /repos/{owner}/{repo}/commits/{ref}/check-runs
    return undefined;
  }
}
