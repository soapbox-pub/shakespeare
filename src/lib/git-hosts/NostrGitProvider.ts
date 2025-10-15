import { NRelay1 } from '@nostrify/nostrify';
import type {
  GitHostProvider,
  GitHostConfig,
  GitRepository,
  GitFork,
  PullRequest,
  CreatePullRequestOptions,
  GitHostUser,
} from './types';

interface NostrSigner {
  signEvent: (event: { kind: number; content: string; tags: string[][]; created_at: number }) => Promise<unknown>;
}

/**
 * Nostr Git provider implementing NIP-34 (git stuff)
 * Enables creating patches/PRs on Nostr git repositories
 */
export class NostrGitProvider implements GitHostProvider {
  readonly name = 'Nostr Git';
  readonly apiBaseUrl = ''; // Not applicable for Nostr

  private relay: NRelay1;
  private signer: NostrSigner;
  private pubkey: string;
  private relayUrls: string[];

  constructor(config: GitHostConfig & { signer: NostrSigner; pubkey: string; relayUrls: string[] }) {
    this.signer = config.signer;
    this.pubkey = config.pubkey;
    this.relayUrls = config.relayUrls;

    // For Nostr git, we need to publish to the repository's designated relays
    // The relay will be set dynamically when we know which repo we're working with
    this.relay = new NRelay1('wss://relay.nostr.band'); // Default, will be changed
  }

  private async queryRepo(owner: string, repo: string): Promise<{ tags: string[][]; content: string }> {
    // Query for repository announcement (kind 30617)
    // d tag is the repo-id (usually kebab-case short name)
    const events = await this.relay.query([
      {
        kinds: [30617],
        authors: [owner], // owner is the pubkey
        '#d': [repo], // repo is the d tag identifier
        limit: 1,
      }
    ]);

    if (events.length === 0) {
      throw new Error(`Repository not found: ${owner}/${repo}`);
    }

    return events[0];
  }

  async getRepository(owner: string, repo: string): Promise<GitRepository> {
    const event = await this.queryRepo(owner, repo);

    const getName = () => event.tags.find((t: string[]) => t[0] === 'name')?.[1] || repo;
    const getDescription = () => event.tags.find((t: string[]) => t[0] === 'description')?.[1];
    const getWebUrl = () => event.tags.find((t: string[]) => t[0] === 'web')?.[1] || '';
    const getCloneUrl = () => event.tags.find((t: string[]) => t[0] === 'clone')?.[1] || '';
    const getRelays = () => event.tags.filter((t: string[]) => t[0] === 'relays').map((t: string[]) => t[1]);

    // Update relay to use repository's designated relays
    const repoRelays = getRelays();
    if (repoRelays.length > 0) {
      this.relayUrls = repoRelays;
      this.relay = new NRelay1(repoRelays[0]);
    }

    return {
      owner,
      name: getName(),
      fullName: `${owner}/${repo}`,
      defaultBranch: 'main', // Nostr git doesn't specify, assume main
      cloneUrl: getCloneUrl(),
      webUrl: getWebUrl(),
      description: getDescription(),
      isPrivate: false, // All Nostr repos are public
    };
  }

  async canUserPush(owner: string, repo: string): Promise<boolean> {
    // In Nostr git, anyone can submit patches (kind 1617)
    // But only maintainers can apply them
    // Check if current user is listed as a maintainer
    const event = await this.queryRepo(owner, repo);
    const maintainers = event.tags
      .filter((t: string[]) => t[0] === 'maintainers')
      .map((t: string[]) => t[1]);

    // Repo owner is always a maintainer
    const isMaintainer = owner === this.pubkey || maintainers.includes(this.pubkey);
    return isMaintainer;
  }

  async createFork(owner: string, repo: string): Promise<GitFork> {
    // In Nostr git, there's no explicit "fork" concept
    // Users submit patches to the original repo
    // For compatibility with the PR flow, we return a "virtual fork"
    const repoEvent = await this.queryRepo(owner, repo);
    const cloneUrl = repoEvent.tags.find((t: string[]) => t[0] === 'clone')?.[1] || '';
    const webUrl = repoEvent.tags.find((t: string[]) => t[0] === 'web')?.[1] || '';

    // The "fork" is actually just the user's local copy
    // We'll use this to track that patches come from the user
    return {
      owner: this.pubkey,
      name: repo,
      fullName: `${this.pubkey}/${repo}`,
      cloneUrl,
      webUrl,
      parentFullName: `${owner}/${repo}`,
    };
  }

  async getFork(_upstreamOwner: string, _upstreamRepo: string, _username: string): Promise<GitFork | null> {
    // Nostr git doesn't have forks - patches are submitted directly
    // Return null to indicate no fork exists
    return null;
  }

  async waitForFork(upstreamOwner: string, upstreamRepo: string, _username: string, _timeout = 10000): Promise<GitFork> {
    // Create a virtual fork immediately
    return this.createFork(upstreamOwner, upstreamRepo);
  }

  async createPullRequest(options: CreatePullRequestOptions): Promise<PullRequest> {
    // In Nostr git, a "pull request" is a patch event (kind 1617)
    // The patch content should be the output of `git format-patch`

    const [owner, repo] = options.baseRepo.split('/');
    const repoEvent = await this.queryRepo(owner, repo);

    // Get the earliest unique commit (euc) for the repository
    const euc = repoEvent.tags.find((t: string[]) => t[0] === 'r' && t[2] === 'euc')?.[1];

    // Create patch content from the provided body or generate a simple patch description
    const patchContent = options.body ||
      `Patch proposal: ${options.title}\n\nFrom: ${options.headBranch}\nTo: ${options.baseBranch}`;

    // Create patch event (kind 1617)
    const patchEvent = await this.signer.signEvent({
      kind: 1617,
      content: patchContent,
      tags: [
        ['a', `30617:${owner}:${repo}`], // Reference to repository announcement
        ['p', owner], // Repository owner
        ['t', 'root'], // Root patch in series
        ['t', 'root-revision'], // First patch in a revision
        ['subject', options.title], // Use subject tag for title
        // Optional: Add r tag for euc if available
        ...(euc ? [['r', euc]] : []),
      ],
      created_at: Math.floor(Date.now() / 1000),
    });

    // Publish to repository's designated relays
    await this.relay.event(patchEvent);

    // Return a PullRequest-compatible object
    return {
      number: parseInt(patchEvent.id.slice(0, 8), 16), // Use first 8 chars of event ID as number
      title: options.title,
      body: options.body,
      state: 'open',
      headBranch: options.headBranch,
      baseBranch: options.baseBranch,
      headRepo: options.headRepo,
      baseRepo: options.baseRepo,
      url: `nostr:${patchEvent.id}`, // Nostr event reference
      createdAt: new Date(patchEvent.created_at * 1000),
      updatedAt: new Date(patchEvent.created_at * 1000),
      author: this.pubkey,
    };
  }

  async getPullRequest(_owner: string, _repo: string, _number: number): Promise<PullRequest> {
    // Query for patch event by converting number back to event ID
    // This is a limitation - we'd need to store the mapping or query differently
    throw new Error('Getting specific patches by number is not yet implemented for Nostr git');
  }

  async listPullRequests(owner: string, repo: string, _state: 'open' | 'closed' | 'all' = 'open'): Promise<PullRequest[]> {
    // Query for patch events (kind 1617) referencing this repository
    const events = await this.relay.query([
      {
        kinds: [1617],
        '#a': [`30617:${owner}:${repo}`],
        '#t': ['root'], // Only root patches, not replies
        limit: 50,
      }
    ]);

    // For state filtering, we'd need to check status events (kind 1630-1633)
    // For now, return all as 'open'
    return events.map(event => ({
      number: parseInt(event.id.slice(0, 8), 16),
      title: event.tags.find((t: string[]) => t[0] === 'subject')?.[1] || 'Untitled patch',
      body: event.content,
      state: 'open' as const,
      headBranch: 'unknown', // Not stored in NIP-34
      baseBranch: 'unknown', // Not stored in NIP-34
      headRepo: `${event.pubkey}/${repo}`,
      baseRepo: `${owner}/${repo}`,
      url: `nostr:${event.id}`,
      createdAt: new Date(event.created_at * 1000),
      updatedAt: new Date(event.created_at * 1000),
      author: event.pubkey,
    }));
  }

  async updatePullRequest(_owner: string, _repo: string, _number: number, _options: { title?: string; body?: string }): Promise<PullRequest> {
    // In Nostr git, you can't edit events - you'd create a new revision
    throw new Error('Updating patches is not supported - create a new revision instead');
  }

  async closePullRequest(_owner: string, _repo: string, _number: number): Promise<PullRequest> {
    // To close a patch, publish a status event (kind 1632 - Closed)
    throw new Error('Closing patches via status events is not yet implemented');
  }

  async getCurrentUser(): Promise<GitHostUser> {
    // In Nostr, we can query the user's profile (kind 0)
    const profiles = await this.relay.query([
      {
        kinds: [0],
        authors: [this.pubkey],
        limit: 1,
      }
    ]);

    if (profiles.length > 0) {
      const profile = JSON.parse(profiles[0].content);
      return {
        username: profile.name || this.pubkey.slice(0, 8),
        name: profile.display_name || profile.name,
        email: profile.nip05,
        avatarUrl: profile.picture,
      };
    }

    return {
      username: this.pubkey.slice(0, 8),
    };
  }

  getCompareUrl(_baseRepo: string, _baseBranch: string, _headRepo: string, _headBranch: string): string {
    // Nostr git doesn't have a web compare view
    // Could potentially link to a Nostr client that displays patches
    return '';
  }
}
