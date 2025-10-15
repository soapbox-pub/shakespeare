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

interface GitLabMRResponse {
  id: number;
  iid: number;
  state: string;
  title: string;
  description: string;
  web_url: string;
  created_at: string;
  updated_at: string;
  author: { username: string };
  source_branch: string;
  target_branch: string;
  source_project_id: number;
  target_project_id: number;
  merge_status?: string;
  merged_at?: string;
  pipeline?: {
    status: string;
    web_url: string;
  };
}

export class GitLabProvider implements GitHostProvider {
  readonly name = 'GitLab';
  readonly apiBaseUrl = 'https://gitlab.com/api/v4';

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
        'Authorization': `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitLab API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  private encodeProjectPath(owner: string, repo: string): string {
    return encodeURIComponent(`${owner}/${repo}`);
  }

  async getRepository(owner: string, repo: string): Promise<GitRepository> {
    interface GitLabProject {
      namespace: { path: string };
      path: string;
      path_with_namespace: string;
      default_branch: string;
      http_url_to_repo: string;
      web_url: string;
      description: string;
      visibility: string;
    }

    const projectPath = this.encodeProjectPath(owner, repo);
    const data = await this.fetch<GitLabProject>(`/projects/${projectPath}`);

    return {
      owner: data.namespace.path,
      name: data.path,
      fullName: data.path_with_namespace,
      defaultBranch: data.default_branch,
      cloneUrl: data.http_url_to_repo,
      webUrl: data.web_url,
      description: data.description,
      isPrivate: data.visibility === 'private',
    };
  }

  async canUserPush(owner: string, repo: string): Promise<boolean> {
    try {
      interface GitLabProjectWithPermissions {
        permissions?: {
          project_access?: { access_level?: number };
        };
      }

      const projectPath = this.encodeProjectPath(owner, repo);
      const data = await this.fetch<GitLabProjectWithPermissions>(`/projects/${projectPath}`);

      // GitLab permissions are more granular
      // developer (30), maintainer (40), or owner (50) can push
      const accessLevel = data.permissions?.project_access?.access_level || 0;
      return accessLevel >= 30;
    } catch {
      return false;
    }
  }

  async createFork(owner: string, repo: string): Promise<GitFork> {
    interface GitLabFork {
      namespace: { path: string };
      path: string;
      path_with_namespace: string;
      http_url_to_repo: string;
      web_url: string;
      forked_from_project?: { path_with_namespace: string };
    }

    const projectPath = this.encodeProjectPath(owner, repo);
    const data = await this.fetch<GitLabFork>(`/projects/${projectPath}/fork`, {
      method: 'POST',
    });

    return {
      owner: data.namespace.path,
      name: data.path,
      fullName: data.path_with_namespace,
      cloneUrl: data.http_url_to_repo,
      webUrl: data.web_url,
      parentFullName: data.forked_from_project?.path_with_namespace || `${owner}/${repo}`,
    };
  }

  async getFork(upstreamOwner: string, upstreamRepo: string, username: string): Promise<GitFork | null> {
    try {
      interface GitLabForkCheck {
        namespace: { path: string };
        path: string;
        path_with_namespace: string;
        http_url_to_repo: string;
        web_url: string;
        forked_from_project?: { path_with_namespace: string };
      }

      const forkPath = this.encodeProjectPath(username, upstreamRepo);
      const data = await this.fetch<GitLabForkCheck>(`/projects/${forkPath}`);

      // Check if it's a fork of the upstream
      if (data.forked_from_project?.path_with_namespace === `${upstreamOwner}/${upstreamRepo}`) {
        return {
          owner: data.namespace.path,
          name: data.path,
          fullName: data.path_with_namespace,
          cloneUrl: data.http_url_to_repo,
          webUrl: data.web_url,
          parentFullName: data.forked_from_project.path_with_namespace,
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
    // In GitLab, MRs are created on the source (fork) project
    const sourceProjectPath = this.encodeProjectPath(options.headRepo.split('/')[0], options.headRepo.split('/')[1]);
    const [targetOwner, targetRepo] = options.baseRepo.split('/');

    const data = await this.fetch<GitLabMRResponse>(`/projects/${sourceProjectPath}/merge_requests`, {
      method: 'POST',
      body: JSON.stringify({
        source_branch: options.headBranch,
        target_branch: options.baseBranch,
        target_project_id: this.encodeProjectPath(targetOwner, targetRepo),
        title: options.title,
        description: options.body || '',
        allow_collaboration: options.maintainerCanModify ?? true,
      }),
    });

    return this.transformMergeRequest(data);
  }

  async getPullRequest(owner: string, repo: string, number: number): Promise<PullRequest> {
    const projectPath = this.encodeProjectPath(owner, repo);
    const data = await this.fetch<GitLabMRResponse>(`/projects/${projectPath}/merge_requests/${number}`);
    return this.transformMergeRequest(data);
  }

  async listPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open'
  ): Promise<PullRequest[]> {
    const projectPath = this.encodeProjectPath(owner, repo);
    const stateParam = state === 'all' ? 'all' : state === 'open' ? 'opened' : 'closed';
    const data = await this.fetch<GitLabMRResponse[]>(`/projects/${projectPath}/merge_requests?state=${stateParam}`);
    return data.map(mr => this.transformMergeRequest(mr));
  }

  async updatePullRequest(
    owner: string,
    repo: string,
    number: number,
    options: { title?: string; body?: string }
  ): Promise<PullRequest> {
    const projectPath = this.encodeProjectPath(owner, repo);
    const data = await this.fetch<GitLabMRResponse>(`/projects/${projectPath}/merge_requests/${number}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: options.title,
        description: options.body,
      }),
    });

    return this.transformMergeRequest(data);
  }

  async closePullRequest(owner: string, repo: string, number: number): Promise<PullRequest> {
    const projectPath = this.encodeProjectPath(owner, repo);
    const data = await this.fetch<GitLabMRResponse>(`/projects/${projectPath}/merge_requests/${number}`, {
      method: 'PUT',
      body: JSON.stringify({
        state_event: 'close',
      }),
    });

    return this.transformMergeRequest(data);
  }

  async getCurrentUser(): Promise<GitHostUser> {
    interface GitLabUser {
      username: string;
      name: string;
      email: string;
      avatar_url: string;
    }

    const data = await this.fetch<GitLabUser>('/user');

    return {
      username: data.username,
      name: data.name,
      email: data.email,
      avatarUrl: data.avatar_url,
    };
  }

  getCompareUrl(baseRepo: string, baseBranch: string, headRepo: string, headBranch: string): string {
    const [headOwner, headRepoName] = headRepo.split('/');
    return `https://gitlab.com/${baseRepo}/-/merge_requests/new?merge_request[source_branch]=${headBranch}&merge_request[source_project]=${headOwner}/${headRepoName}&merge_request[target_branch]=${baseBranch}`;
  }

  private transformMergeRequest(data: GitLabMRResponse): PullRequest {
    const state = data.state === 'merged' ? 'merged' : data.state === 'opened' ? 'open' : 'closed';

    return {
      number: data.iid, // GitLab uses iid (internal id) for MRs
      title: data.title,
      body: data.description,
      state,
      headBranch: data.source_branch,
      baseBranch: data.target_branch,
      headRepo: data.source_project_id?.toString() || '',
      baseRepo: data.target_project_id?.toString() || '',
      url: data.web_url,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      author: data.author.username,
      mergeable: data.merge_status === 'can_be_merged',
      checks: this.transformPipeline(data),
    };
  }

  private transformPipeline(data: GitLabMRResponse): PullRequestCheck[] | undefined {
    if (!data.pipeline) return undefined;

    const mapConclusion = (status: string): PullRequestCheck['conclusion'] => {
      switch (status) {
        case 'success': return 'success';
        case 'failed': return 'failure';
        case 'canceled': return 'cancelled';
        case 'skipped': return 'skipped';
        default: return undefined;
      }
    };

    return [{
      name: 'Pipeline',
      status: data.pipeline.status === 'running' ? 'pending' :
        data.pipeline.status === 'success' ? 'success' : 'failure',
      conclusion: mapConclusion(data.pipeline.status),
      detailsUrl: data.pipeline.web_url,
    }];
  }
}
