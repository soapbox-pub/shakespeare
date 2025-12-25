import git, { FetchResult, GitHttpRequest, GitHttpResponse, HttpClient } from 'isomorphic-git';
import { proxyUrl } from './proxyUrl';
import { readGitSettings } from './configUtils';
import { parseRepositoryAnnouncement, RepositoryAnnouncement } from './announceRepository';
import { NostrURI } from './NostrURI';
import type { NostrEvent, NostrSigner, NPool } from '@nostrify/nostrify';
import type { JSRuntimeFS } from './JSRuntime';
import type { GitCredential } from '@/contexts/GitSettingsContext';
import { findCredentialsForRepo } from './gitCredentials';

export interface GitOptions {
  fs: JSRuntimeFS;
  nostr: NPool;
  corsProxy?: string;
  ngitServers?: string[];
  systemAuthor?: { name: string; email: string };
  signer?: NostrSigner;
  credentials?: GitCredential[];
}

/**
 * Git class that wraps isomorphic-git and provides a cleaner interface.
 * Instantiate with an fs implementation, optional corsProxy string, and optional corsProxyRegex.
 * All methods have the same names as isomorphic-git but don't require
 * passing fs, http, and corsProxy each time.
 */
export class Git {
  private fs: JSRuntimeFS;
  private nostr: NPool;
  private ngitServers: string[];
  private systemAuthor: { name: string; email: string };
  private signer?: NostrSigner;
  private corsProxy?: string;
  private credentials?: GitCredential[];

  constructor(options: GitOptions) {
    this.fs = options.fs;
    this.nostr = options.nostr;
    this.corsProxy = options.corsProxy;
    this.ngitServers = options.ngitServers ?? ['git.shakespeare.diy', 'relay.ngit.dev'];
    this.systemAuthor = options.systemAuthor ?? {
      name: 'shakespeare.diy',
      email: 'assistant@shakespeare.diy',
    };
    this.credentials = options.credentials;
    this.signer = options.signer;
  }

  // Shared onAuth method
  onAuth = (url: string) => {
    if (this.credentials) {
      return findCredentialsForRepo(url, this.credentials);
    }
  }

  // Get HTTP adapter for the given URL
  private httpForUrl(url: string | null | undefined): GitHttp {
    if (url?.startsWith('nostr://')) {
      return new GitHttp();
    }
    if (this.credentials && url) {
      const cred = findCredentialsForRepo(url, this.credentials);
      if (cred && cred.proxy) {
        return new GitHttp(this.corsProxy);
      }
    }
    return new GitHttp();
  }

  // Repository initialization and configuration
  async init(options: Omit<Parameters<typeof git.init>[0], 'fs'>) {
    return git.init({
      fs: this.fs,
      ...options,
    });
  }

  async clone(options: Omit<Parameters<typeof git.clone>[0], 'fs' | 'http' | 'corsProxy'>) {
    // Check if the URL is a Nostr URI
    if (options.url.startsWith('nostr://')) {
      const nostrURI = await NostrURI.parse(options.url);
      // Try cloning from Nostr
      return this.nostrClone(nostrURI, options);
    }

    // Regular Git URL
    return git.clone({
      fs: this.fs,
      http: this.httpForUrl(options.url),
      onAuth: this.onAuth,
      ...options,
    });
  }

  // Working with files
  async add(options: Omit<Parameters<typeof git.add>[0], 'fs'>) {
    return git.add({
      fs: this.fs,
      ...options,
    });
  }

  async remove(options: Omit<Parameters<typeof git.remove>[0], 'fs'>) {
    return git.remove({
      fs: this.fs,
      ...options,
    });
  }

  async status(options: Omit<Parameters<typeof git.status>[0], 'fs'>) {
    return git.status({
      fs: this.fs,
      ...options,
    });
  }

  async statusMatrix(options: Omit<Parameters<typeof git.statusMatrix>[0], 'fs'>) {
    return git.statusMatrix({
      fs: this.fs,
      ...options,
    });
  }

  // Commits and history
  async commit(options: Omit<Parameters<typeof git.commit>[0], 'fs' | 'author'>) {
    const { author, coAuthorEnabled } = await this.getGitSettings();

    // Add system co-author if enabled
    let message = options.message;
    if (coAuthorEnabled) {
      message = `${message}\n\nCo-authored-by: ${this.systemAuthor.name} <${this.systemAuthor.email}>`;
    }

    return git.commit({
      fs: this.fs,
      ...options,
      author,
      message,
    });
  }

  async log(options: Omit<Parameters<typeof git.log>[0], 'fs'>) {
    return git.log({
      fs: this.fs,
      ...options,
    });
  }

  async readCommit(options: Omit<Parameters<typeof git.readCommit>[0], 'fs'>) {
    return git.readCommit({
      fs: this.fs,
      ...options,
    });
  }

  // Branches
  async branch(options: Omit<Parameters<typeof git.branch>[0], 'fs'>) {
    return git.branch({
      fs: this.fs,
      ...options,
    });
  }

  async checkout(options: Omit<Parameters<typeof git.checkout>[0], 'fs'>) {
    return git.checkout({
      fs: this.fs,
      ...options,
    });
  }

  async currentBranch(options: Omit<Parameters<typeof git.currentBranch>[0], 'fs'>) {
    return git.currentBranch({
      fs: this.fs,
      ...options,
    });
  }

  async deleteBranch(options: Omit<Parameters<typeof git.deleteBranch>[0], 'fs'>) {
    return git.deleteBranch({
      fs: this.fs,
      ...options,
    });
  }

  async listBranches(options: Omit<Parameters<typeof git.listBranches>[0], 'fs'>) {
    return git.listBranches({
      fs: this.fs,
      ...options,
    });
  }

  // Remote operations
  async addRemote(options: Omit<Parameters<typeof git.addRemote>[0], 'fs'>) {
    return git.addRemote({
      fs: this.fs,
      ...options,
    });
  }

  async deleteRemote(options: Omit<Parameters<typeof git.deleteRemote>[0], 'fs'>) {
    return git.deleteRemote({
      fs: this.fs,
      ...options,
    });
  }

  async listRemotes(options: Omit<Parameters<typeof git.listRemotes>[0], 'fs'>) {
    return git.listRemotes({
      fs: this.fs,
      ...options,
    });
  }

  async getRemoteInfo(options: Omit<Parameters<typeof git.getRemoteInfo>[0], 'http' | 'corsProxy'>) {
    // Check if the URL is a Nostr URI
    if (options.url.startsWith('nostr://')) {
      const nostrURI = await NostrURI.parse(options.url);
      return this.getNostrRemoteInfo(nostrURI);
    }

    return git.getRemoteInfo({
      http: this.httpForUrl(options.url),
      onAuth: this.onAuth,
      ...options,
    });
  }

  async fetch(options: Omit<Parameters<typeof git.fetch>[0], 'fs' | 'http' | 'corsProxy'>) {
    // Check if this is a Nostr repository by looking at the remote URL
    const remote = options.remote || 'origin';
    const dir = options.dir || '.';
    const remoteUrl = options.url || await this.getRemoteURL(dir, remote);

    if (remoteUrl && remoteUrl.startsWith('nostr://')) {
      const nostrURI = await NostrURI.parse(remoteUrl);
      return this.nostrFetch(nostrURI, { ...options, remote, dir });
    }

    // Regular Git fetch
    return git.fetch({
      fs: this.fs,
      http: this.httpForUrl(remoteUrl),
      onAuth: this.onAuth,
      ...options,
      remote,
    });
  }

  async pull(options: Omit<Parameters<typeof git.pull>[0], 'fs' | 'http' | 'author' | 'corsProxy'>) {
    // Check if this is a Nostr repository by looking at the remote URL
    const remote = options.remote || 'origin';
    const dir = options.dir || '.';
    const remoteUrl = options.url || await this.getRemoteURL(dir, remote);
    const { author } = await this.getGitSettings();

    if (remoteUrl && remoteUrl.startsWith('nostr://')) {
      const nostrURI = await NostrURI.parse(remoteUrl);
      return this.nostrPull(nostrURI, { ...options, author, remote, dir });
    }

    // Regular Git pull
    return git.pull({
      fs: this.fs,
      http: this.httpForUrl(remoteUrl),
      onAuth: this.onAuth,
      ...options,
      author,
    });
  }

  async push(options: Omit<Parameters<typeof git.push>[0], 'fs' | 'http' | 'onAuth' | 'corsProxy'>) {
    // Check if this is a Nostr repository by looking at the remote URL
    const remote = options.remote || 'origin';
    const dir = options.dir || '.';
    const remoteUrl = options.url || await this.getRemoteURL(dir, remote);

    if (remoteUrl && remoteUrl.startsWith('nostr://')) {
      const nostrURI = await NostrURI.parse(remoteUrl);
      return this.nostrPush(nostrURI, { ...options, remote, dir: dir });
    }

    return git.push({
      fs: this.fs,
      http: this.httpForUrl(remoteUrl),
      onAuth: this.onAuth,
      ...options,
    });
  }

  // Tags
  async tag(options: Omit<Parameters<typeof git.tag>[0], 'fs'>) {
    return git.tag({
      fs: this.fs,
      ...options,
    });
  }

  async deleteTag(options: Omit<Parameters<typeof git.deleteTag>[0], 'fs'>) {
    return git.deleteTag({
      fs: this.fs,
      ...options,
    });
  }

  async listTags(options: Omit<Parameters<typeof git.listTags>[0], 'fs'>) {
    return git.listTags({
      fs: this.fs,
      ...options,
    });
  }

  // Configuration
  async getConfig(options: Omit<Parameters<typeof git.getConfig>[0], 'fs'>) {
    return git.getConfig({
      fs: this.fs,
      ...options,
    });
  }

  async setConfig(options: Omit<Parameters<typeof git.setConfig>[0], 'fs'>) {
    return git.setConfig({
      fs: this.fs,
      ...options,
    });
  }

  async getConfigAll(options: Omit<Parameters<typeof git.getConfigAll>[0], 'fs'>) {
    return git.getConfigAll({
      fs: this.fs,
      ...options,
    });
  }

  // Walking and comparisons

  async walk(options: Omit<Parameters<typeof git.walk>[0], 'fs'>) {
    return git.walk({
      fs: this.fs,
      ...options,
    });
  }

  // Reset operations
  async resetIndex(options: Omit<Parameters<typeof git.resetIndex>[0], 'fs'>) {
    return git.resetIndex({
      fs: this.fs,
      ...options,
    });
  }

  // Object operations
  async readObject(options: Omit<Parameters<typeof git.readObject>[0], 'fs'>) {
    return git.readObject({
      fs: this.fs,
      ...options,
    });
  }

  async writeObject(options: Omit<Parameters<typeof git.writeObject>[0], 'fs'>) {
    return git.writeObject({
      fs: this.fs,
      ...options,
    });
  }

  async readTree(options: Omit<Parameters<typeof git.readTree>[0], 'fs'>) {
    return git.readTree({
      fs: this.fs,
      ...options,
    });
  }

  async writeTree(options: Omit<Parameters<typeof git.writeTree>[0], 'fs'>) {
    return git.writeTree({
      fs: this.fs,
      ...options,
    });
  }

  async readBlob(options: Omit<Parameters<typeof git.readBlob>[0], 'fs'>) {
    return git.readBlob({
      fs: this.fs,
      ...options,
    });
  }

  async writeBlob(options: Omit<Parameters<typeof git.writeBlob>[0], 'fs'>) {
    return git.writeBlob({
      fs: this.fs,
      ...options,
    });
  }

  // Index operations
  async updateIndex(options: Omit<Parameters<typeof git.updateIndex>[0], 'fs'>) {
    return git.updateIndex({
      fs: this.fs,
      ...options,
    });
  }

  // Merge operations
  async merge(options: Omit<Parameters<typeof git.merge>[0], 'fs' | 'author'>) {
    const { author } = await this.getGitSettings();

    return git.merge({
      fs: this.fs,
      ...options,
      author,
    });
  }

  async findMergeBase(options: Omit<Parameters<typeof git.findMergeBase>[0], 'fs'>) {
    return git.findMergeBase({
      fs: this.fs,
      ...options,
    });
  }

  // Utilities
  async isDescendent(options: Omit<Parameters<typeof git.isDescendent>[0], 'fs'>) {
    return git.isDescendent({
      fs: this.fs,
      ...options,
    });
  }

  async findRoot(options: Omit<Parameters<typeof git.findRoot>[0], 'fs'>) {
    return git.findRoot({
      fs: this.fs,
      ...options,
    });
  }

  async getRemoteInfo2(options: Omit<Parameters<typeof git.getRemoteInfo2>[0], 'http' | 'corsProxy'>) {
    return git.getRemoteInfo2({
      http: this.httpForUrl(options.url),
      onAuth: this.onAuth,
      ...options,
    });
  }

  async listFiles(options: Omit<Parameters<typeof git.listFiles>[0], 'fs'>) {
    return git.listFiles({
      fs: this.fs,
      ...options,
    });
  }

  async hashBlob(options: Parameters<typeof git.hashBlob>[0]) {
    return git.hashBlob(options);
  }

  async annotatedTag(options: Omit<Parameters<typeof git.annotatedTag>[0], 'fs'>) {
    return git.annotatedTag({
      fs: this.fs,
      ...options,
    });
  }

  async readTag(options: Omit<Parameters<typeof git.readTag>[0], 'fs'>) {
    return git.readTag({
      fs: this.fs,
      ...options,
    });
  }

  async writeTag(options: Omit<Parameters<typeof git.writeTag>[0], 'fs'>) {
    return git.writeTag({
      fs: this.fs,
      ...options,
    });
  }

  async writeRef(options: Omit<Parameters<typeof git.writeRef>[0], 'fs'>) {
    return git.writeRef({
      fs: this.fs,
      ...options,
    });
  }

  async deleteRef(options: Omit<Parameters<typeof git.deleteRef>[0], 'fs'>) {
    return git.deleteRef({
      fs: this.fs,
      ...options,
    });
  }

  async listNotes(options: Omit<Parameters<typeof git.listNotes>[0], 'fs'>) {
    return git.listNotes({
      fs: this.fs,
      ...options,
    });
  }

  async readNote(options: Omit<Parameters<typeof git.readNote>[0], 'fs'>) {
    return git.readNote({
      fs: this.fs,
      ...options,
    });
  }

  async addNote(options: Omit<Parameters<typeof git.addNote>[0], 'fs'>) {
    return git.addNote({
      fs: this.fs,
      ...options,
    });
  }

  async removeNote(options: Omit<Parameters<typeof git.removeNote>[0], 'fs'>) {
    return git.removeNote({
      fs: this.fs,
      ...options,
    });
  }

  // Packfile operations
  async packObjects(options: Omit<Parameters<typeof git.packObjects>[0], 'fs'>) {
    return git.packObjects({
      fs: this.fs,
      ...options,
    });
  }

  async indexPack(options: Omit<Parameters<typeof git.indexPack>[0], 'fs'>) {
    return git.indexPack({
      fs: this.fs,
      ...options,
    });
  }

  // Additional utility methods
  async resolveRef(options: Omit<Parameters<typeof git.resolveRef>[0], 'fs'>) {
    return git.resolveRef({
      fs: this.fs,
      ...options,
    });
  }

  async expandRef(options: Omit<Parameters<typeof git.expandRef>[0], 'fs'>) {
    return git.expandRef({
      fs: this.fs,
      ...options,
    });
  }

  async expandOid(options: Omit<Parameters<typeof git.expandOid>[0], 'fs'>) {
    return git.expandOid({
      fs: this.fs,
      ...options,
    });
  }

  async listRefs(options: Omit<Parameters<typeof git.listRefs>[0], 'fs'>) {
    return git.listRefs({
      fs: this.fs,
      ...options,
    });
  }

  async listServerRefs(options: Omit<Parameters<typeof git.listServerRefs>[0], 'http' | 'corsProxy'>) {
    return git.listServerRefs({
      http: this.httpForUrl(options.url),
      onAuth: this.onAuth,
      ...options,
    });
  }

  async renameBranch(options: Omit<Parameters<typeof git.renameBranch>[0], 'fs'>) {
    return git.renameBranch({
      fs: this.fs,
      ...options,
    });
  }

  async isIgnored(options: Omit<Parameters<typeof git.isIgnored>[0], 'fs'>) {
    return git.isIgnored({
      fs: this.fs,
      ...options,
    });
  }

  async fastForward(options: Omit<Parameters<typeof git.fastForward>[0], 'fs'>) {
    return git.fastForward({
      fs: this.fs,
      ...options,
    });
  }

  async abortMerge(options: Omit<Parameters<typeof git.abortMerge>[0], 'fs'>) {
    return git.abortMerge({
      fs: this.fs,
      ...options,
    });
  }

  async writeCommit(options: Omit<Parameters<typeof git.writeCommit>[0], 'fs'>) {
    return git.writeCommit({
      fs: this.fs,
      ...options,
    });
  }

  // Version info
  version() {
    return git.version();
  }

  private async getGitSettings(): Promise<{ author: { name: string; email: string }; coAuthorEnabled: boolean }> {
    const {
      name,
      email,
      coAuthorEnabled = true,
    } = await readGitSettings(this.fs);

    if (name && email) {
      return {
        author: { name, email },
        coAuthorEnabled,
      };
    } else {
      return {
        author: this.systemAuthor,
        coAuthorEnabled,
      }
    }
  }

  // Nostr-specific helper methods

  /**
   * Get remote info for a Nostr repository URI
   */
  private async getNostrRemoteInfo(nostrURI: NostrURI): Promise<{
    capabilities: string[];
    refs: Record<string, string>;
    HEAD?: string;
  }> {
    console.log(`Getting remote info for Nostr repository: ${nostrURI.toString()}`);

    // Fetch the repository announcement and state from Nostr
    const { repo, state } = await this.fetchNostrRepoEvents(nostrURI);

    if (!repo) {
      throw new Error('Repository announcement not found on Nostr network');
    }

    // Extract refs from the state event if available
    const refs: Record<string, string> = {};
    let HEAD: string | undefined;

    if (state) {

      // Add all refs from the state
      Object.assign(refs, state.refs);

      // Set HEAD
      if (state.HEAD) {
        HEAD = state.HEAD;
      }
    } else {
      // No state event, try to get info from the first available clone URL
      if (repo.httpsCloneUrls.length > 0) {
        // Try to get remote info from the first clone URL
        try {
          const gitRemoteInfo = await git.getRemoteInfo({
            http: this.httpForUrl(undefined),
            onAuth: this.onAuth,
            url: repo.httpsCloneUrls[0],
          });

          Object.assign(refs, gitRemoteInfo.refs);
          HEAD = gitRemoteInfo.HEAD;
        } catch (error) {
          console.warn(`Failed to get remote info from ${repo.httpsCloneUrls[0]}:`, error);
          // Continue with empty refs if we can't get git remote info
        }
      }
    }

    // Nostr repositories support the same capabilities as regular Git repos
    const capabilities = [
      'multi_ack',
      'thin-pack',
      'side-band',
      'side-band-64k',
      'ofs-delta',
      'shallow',
      'deepen-since',
      'deepen-not',
      'deepen-relative',
      'no-progress',
      'include-tag',
      'multi_ack_detailed',
      'allow-tip-sha1-in-want',
      'allow-reachable-sha1-in-want',
    ];

    return {
      capabilities,
      refs,
      HEAD,
    };
  }

  /**
   * Create initial repository state from current local git repository
   * This should only be used when no existing state event is found
   */
  private async createInitialRepositoryState(
    dir: string,
    dTag: string,
    signer: NostrSigner
  ): Promise<NostrEvent> {
    const refTags: string[][] = [];
    let headRef: string | undefined;

    try {
      // Get all refs in the repository
      const refs = await git.listRefs({ fs: this.fs, dir });

      // Process each ref to create tags
      for (const ref of refs) {
        try {
          const commitId = await git.resolveRef({
            fs: this.fs,
            dir,
            ref,
          });

          // Only include heads and tags refs in the state event
          if (ref.startsWith('refs/heads/') || ref.startsWith('refs/tags/')) {
            refTags.push([ref, commitId]);
          }
        } catch (error) {
          console.warn(`Failed to resolve ref ${ref}:`, error);
        }
      }

      // If no refs found, try to get the current branch directly
      if (refTags.length === 0) {
        try {
          const currentBranch = await this.currentBranch({ dir });
          if (currentBranch) {
            const currentCommit = await this.resolveRef({ dir, ref: 'HEAD' });
            refTags.push([`refs/heads/${currentBranch}`, currentCommit]);
            console.log(`Added current branch: refs/heads/${currentBranch} -> ${currentCommit}`);
          } else {
            // Try to get HEAD directly even if no current branch
            try {
              const headCommit = await this.resolveRef({ dir, ref: 'HEAD' });
              refTags.push(['refs/heads/main', headCommit]); // Assume main branch
              console.log(`Added assumed main branch: refs/heads/main -> ${headCommit}`);
            } catch (headError) {
              console.warn('Failed to resolve HEAD directly:', headError);
            }
          }
        } catch (error) {
          console.warn('Failed to get current branch:', error);
        }
      }

      if (refTags.length === 0) {
        throw new Error('Could not determine repository state. The repository might not have any commits or branches.');
      }

      // Get HEAD reference
      try {
        const headValue = await git.resolveRef({
          fs: this.fs,
          dir,
          ref: 'HEAD',
          depth: 1, // Don't resolve symbolic refs
        });

        // Check if HEAD is symbolic (points to a branch)
        try {
          const currentBranch = await git.currentBranch({ fs: this.fs, dir });
          if (currentBranch) {
            headRef = `ref: refs/heads/${currentBranch}`;
          }
        } catch {
          // HEAD is detached, use the commit ID directly
          if (headValue) {
            headRef = headValue;
          }
        }
      } catch (error) {
        console.warn('Failed to resolve HEAD:', error);
      }

      console.log(`Repository state: ${refTags.length} refs, HEAD=${headRef}`);
    } catch (error) {
      console.error('Failed to get repository state:', error);
      throw new Error(`Failed to get repository state: ${error}`);
    }

    // Create and sign the state event
    return await signer.signEvent({
      kind: 30618,
      created_at: Math.floor(Date.now() / 1000),
      content: '',
      tags: [
        ['d', dTag],
        ...refTags,
        ...(headRef ? [['HEAD', headRef]] : []),
      ],
    });
  }

  /**
   * Apply changes from a push operation to repository state and create updated event
   * Mutates the state object directly and returns the signed event
   */
  private async applyPushAndUpdateStateEvent(
    state: RespositoryState,
    remoteRef: string,
    newCommit: string,
    signer: NostrSigner
  ): Promise<NostrEvent> {
    const remoteRefName = remoteRef.startsWith('refs/') ? remoteRef : `refs/heads/${remoteRef}`;

    // Update the ref
    state.refs[remoteRefName] = newCommit;

    // Update head commit if this ref is HEAD
    if (state.HEAD === `ref: ${remoteRefName}`) {
      state.headCommit = newCommit;
    }

    // Extract d tag from original event
    const dTag = state.event.tags.find(([name]) => name === 'd');
    if (!dTag || !dTag[1]) {
      throw new Error('Repository state event missing required d tag');
    }

    const tags: string[][] = [['d', dTag[1]]];

    // Add HEAD if set
    if (state.HEAD) {
      tags.push(['HEAD', state.HEAD]);
    }
    // Add all refs
    for (const [ref, commit] of Object.entries(state.refs)) {
      tags.push([ref, commit]);
    }

    // Create and sign the updated event
    state.event = await signer.signEvent({
      kind: 30618,
      created_at: Math.floor(Date.now() / 1000),
      content: '',
      tags,
    });

    return state.event;
  }

  /**
   * Validate that a cloned repository matches the expected repository state
   */
  private async validateRepositoryState(
    dir: string,
    expectedCommit?: string,
    expectedBranch?: string,
    expectedRefs?: Record<string, string>
  ): Promise<{ valid: boolean; warnings: string[] }> {
    const warnings: string[] = [];
    let valid = true;

    try {
      // Check if expected commit exists
      if (expectedCommit) {
        try {
          await git.readCommit({
            fs: this.fs,
            dir,
            oid: expectedCommit,
          });
          console.log(`✓ Expected commit ${expectedCommit} found in repository`);
        } catch {
          warnings.push(`Expected commit ${expectedCommit} not found in cloned repository`);
          valid = false;
        }
      }

      // Check if expected branch exists and is current
      if (expectedBranch) {
        try {
          const currentBranch = await git.currentBranch({ fs: this.fs, dir });
          if (currentBranch !== expectedBranch) {
            warnings.push(`Expected branch '${expectedBranch}' but currently on '${currentBranch || 'detached HEAD'}'`);
          } else {
            console.log(`✓ On expected branch: ${expectedBranch}`);
          }
        } catch (error) {
          warnings.push(`Could not determine current branch: ${error}`);
        }
      }

      // Validate key refs if provided
      if (expectedRefs && Object.keys(expectedRefs).length > 0) {
        try {
          const localRefs = await git.listRefs({ fs: this.fs, dir });
          const missingRefs = Object.keys(expectedRefs).filter(ref => !localRefs.includes(ref));

          if (missingRefs.length > 0) {
            warnings.push(`Missing expected refs: ${missingRefs.join(', ')}`);
          } else {
            console.log(`✓ All expected refs found in repository`);
          }
        } catch (error) {
          warnings.push(`Could not validate refs: ${error}`);
        }
      }

    } catch (error) {
      warnings.push(`Repository validation failed: ${error}`);
      valid = false;
    }

    return { valid, warnings };
  }



  /**
   * Process GRASP server mismatch between configured servers and announcement servers.
   * Updates this.ngitServers if there's a mismatch and logs the changes.
   */
  private processNgitServersMismatch(announcementServers: string[]): void {
    const configuredServers = new Set(this.ngitServers);
    const announcementSet = new Set(announcementServers);

    const serversOnlyInConfig = this.ngitServers.filter(s => !announcementSet.has(s));
    const serversOnlyInAnnouncement = announcementServers.filter(s => !configuredServers.has(s));

    const hasMismatch = serversOnlyInConfig.length > 0 || serversOnlyInAnnouncement.length > 0;

    if (hasMismatch) {
      console.log('GRASP server configuration mismatch detected:');
      if (serversOnlyInConfig.length > 0) {
        console.log(`  - Configured but not in announcement: ${serversOnlyInConfig.join(', ')}`);
      }
      if (serversOnlyInAnnouncement.length > 0) {
        console.log(`  - In announcement but not configured: ${serversOnlyInAnnouncement.join(', ')}`);
      }
      console.log(`  - Updating to use announcement servers: ${announcementServers.join(', ')}`);
      this.ngitServers = announcementServers;
    }
  }

  private async fetchNostrRepoEvents(nostrURI: NostrURI): Promise<{
    repo: RepositoryAnnouncement;
    state?: RespositoryState;
    serversWithoutAnnouncement?: string[];
    serversWithoutLatestAnnouncement?: string[];
    serversWithoutState?: string[];
    serversWithoutLatestState?: string[];
    serversWithErrors?: string[];
  }> {
    // Build the filter for both NIP-34 repository announcement and state events
    const filter = {
      kinds: [30617, 30618],
      authors: [nostrURI.pubkey],
      '#d': [nostrURI.identifier],
    };

    // Track all servers we've queried to avoid duplicates
    const queriedServers = new Set<string>();
    const allResults: Array<{ relay: string; events: NostrEvent[]; error?: boolean }> = [];

    // Start with initial servers
    const serversToQuery: string[] = [];

    // Add specified relay if provided
    if (nostrURI.relay) {
      serversToQuery.push(nostrURI.relay);
    }

    // Add configured ngit servers
    serversToQuery.push(...this.ngitServers);

    // Fetch from servers, discovering new ones as we go
    while (serversToQuery.length > 0) {
      const currentBatch = [...serversToQuery];
      serversToQuery.length = 0; // Clear the array

      const fetchPromises: Promise<{ relay: string; events: NostrEvent[]; error?: boolean }>[] = [];

      for (const server of currentBatch) {
        // Skip if we've already queried this server
        if (queriedServers.has(server)) {
          continue;
        }
        queriedServers.add(server);

        const relayUrl = server.startsWith('wss://') ? server : `wss://${server}/`;
        fetchPromises.push(
          this.nostr.relay(relayUrl).query([filter], { signal: AbortSignal.timeout(1000) })
            .then(events => ({ relay: relayUrl, events }))
            .catch(error => {
              console.warn(`Error querying ${server}:`, error);
              return { relay: relayUrl, events: [], error: true };
            })
        );
      }

      const results = await Promise.all(fetchPromises);
      allResults.push(...results);

      // Check each result for new ngit servers to query
      for (const result of results) {
        if (!result.error && result.events.length > 0) {
          // Look for repository announcements (kind 30617) in the results
          const repoEvents = result.events.filter(e => e.kind === 30617);
          for (const repoEvent of repoEvents) {
            // Extract ngit servers from this announcement
            for (const discoveredServer of parseRepositoryAnnouncement(repoEvent).graspServers) {
              if (!queriedServers.has(discoveredServer)) {
                serversToQuery.push(discoveredServer);
              }
            }
          }
        }
      }

      if (serversToQuery.length > 0) {
        console.log(`Discovered ${serversToQuery.length} new ngit servers: ${serversToQuery.join(', ')}`);
      }
    }

    const results = allResults;

    // Collect all events and find the latest versions
    let latestRepo: NostrEvent | undefined;
    let latestState: NostrEvent | undefined;

    for (const result of results) {
      for (const event of result.events) {
        if (event.kind === 30617) {
          if (!latestRepo || event.created_at > latestRepo.created_at) {
            latestRepo = event;
          }
        } else if (event.kind === 30618) {
          if (!latestState || event.created_at > latestState.created_at) {
            latestState = event;
          }
        }
      }
    }

    if (!latestRepo) {
      throw new Error('Repository announcement not found on Nostr network');
    }
    const repo = parseRepositoryAnnouncement(latestRepo);
    let state;
    try {
      if (latestState) {
        state = parseRepositoryState(latestState);
        console.log(`Found repository state event with ${latestState.tags.length} tags`);
      } else {
        console.log('No repository state event found, proceeding with basic clone');
      }
    } catch {
      console.log('Invalid repository state event found, proceeding with basic clone');
    }

    // Get GRASP servers from the announcement and handle any mismatch
    this.processNgitServersMismatch(repo.graspServers);

    // Analyze each ngitserver's status
    const serversWithoutAnnouncement: string[] = [];
    const serversWithoutLatestAnnouncement: string[] = [];
    const serversWithoutState: string[] = [];
    const serversWithoutLatestState: string[] = [];
    const serversWithErrors: string[] = [];

    for (const server of this.ngitServers) {
      const result = results.find(r => r.relay.includes(server));

      if (!result || 'error' in result) {
        // Server errored or timed out
        serversWithErrors.push(server);
        console.warn(`Server ${server} had errors or timed out`);
      } else {
        const serverRepo = result.events.find(e => e.kind === 30617);
        const serverState = result.events.find(e => e.kind === 30618);

        // Check announcement status
        if (!serverRepo) {
          // Server has no announcement at all
          serversWithoutAnnouncement.push(server);
          console.log(`Server ${server} has no announcement event`);
        } else if (serverRepo.created_at < latestRepo.created_at) {
          // Server has outdated announcement
          serversWithoutLatestAnnouncement.push(server);
          console.log(`Server ${server} has outdated announcement (has: ${serverRepo.created_at}, latest: ${latestRepo.created_at})`);
        } else {
          console.log(`Server ${server} has up-to-date announcement`);
        }

        // Check state status (only if we have a latest state to compare against)
        if (latestState) {
          if (!serverState) {
            // Server has no state event at all
            serversWithoutState.push(server);
            console.log(`Server ${server} has no state event`);
          } else if (serverState.created_at < latestState.created_at) {
            // Server has outdated state
            serversWithoutLatestState.push(server);
            console.log(`Server ${server} has outdated state event (has: ${serverState.created_at}, latest: ${latestState.created_at})`);
          } else {
            console.log(`Server ${server} has up-to-date state event`);
          }
        }
      }
    }

    return {
      repo,
      state,
      serversWithoutAnnouncement,
      serversWithoutLatestAnnouncement,
      serversWithoutState: serversWithoutState.length > 0 ? serversWithoutState : undefined,
      serversWithoutLatestState: serversWithoutLatestState.length > 0 ? serversWithoutLatestState : undefined,
      serversWithErrors
    };
  }

  private async nostrClone(nostrURI: NostrURI, options: Omit<Parameters<typeof git.clone>[0], 'fs' | 'http' | 'corsProxy'>): Promise<void> {
    // Fetch events from Nostr
    const { repo, state } = await this.fetchNostrRepoEvents(nostrURI);

    if (!repo) {
      throw new Error('Repository not found');
    }

    // Extract repository state information if available
    let expectedCommit: string | undefined;
    let expectedBranch: string | undefined;
    let repositoryRefs: Record<string, string> = {};

    if (state) {
      expectedCommit = state.headCommit;
      expectedBranch = state.headBranch;
      repositoryRefs = state.refs;

      console.log(`Repository state: HEAD=${state.HEAD}, commit=${expectedCommit}, branch=${expectedBranch}`);
      console.log(`Available refs:`, Object.keys(repositoryRefs));
    }

    // Collect valid clone URLs from the repo event tags
    if (repo.httpsCloneUrls.length === 0) {
      throw new Error('No valid clone URLs found in repository announcement');
    }

    let lastError: Error | null = null;
    let cloneSuccessful = false;

    // Track the clone URL with the most recent commit timestamp
    let bestCloneUrl: string | undefined;
    let bestCloneTimestamp = 0;

    // Loop through all clone URLs, checking remote info for each
    if (expectedCommit) {
      console.log(`Looking for repository with commit: ${expectedCommit}`);
    }

    for (const cloneUrl of repo.httpsCloneUrls) {
      try {
        console.log(`Checking remote info for: ${cloneUrl}`);

        // Get remote repository information
        const remoteInfo = await Promise.race([
          git.getRemoteInfo({
            http: this.httpForUrl(undefined),
            onAuth: this.onAuth,
            url: cloneUrl,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Remote info timeout')), 10000)
          )
        ]);

        // Track this remote's most recent commit timestamp
        // We use the current time as a proxy since we can't easily get commit timestamps
        // from remote info without cloning. The first successful remote will be our fallback.
        const timestamp = Date.now();
        if (!bestCloneUrl || timestamp > bestCloneTimestamp) {
          bestCloneUrl = cloneUrl;
          bestCloneTimestamp = timestamp;
        }

        // Check if the expected commit exists in any of the remote refs
        const hasExpectedCommit = expectedCommit && Object.values(remoteInfo.refs || {}).includes(expectedCommit);

        if (hasExpectedCommit && expectedCommit) {
          console.log(`Found expected commit ${expectedCommit} in ${cloneUrl}`);

          // Clone from this URL since it has the expected commit
          await Promise.race([
            git.clone({
              fs: this.fs,
              http: this.httpForUrl(undefined),
              onAuth: this.onAuth,
              ...options,
              url: cloneUrl,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Clone timeout')), 30000)
            )
          ]);

          // Verify the cloned repository has the expected commit
          try {
            await git.readCommit({
              fs: this.fs,
              dir: options.dir,
              oid: expectedCommit,
            });

            // If we have an expected branch, check out to it
            if (expectedBranch) {
              try {
                await git.checkout({
                  fs: this.fs,
                  dir: options.dir,
                  ref: expectedBranch,
                });
              } catch (checkoutError) {
                console.warn(`Failed to checkout branch ${expectedBranch}:`, checkoutError);
                // Continue anyway, the clone was successful
              }
            }

            cloneSuccessful = true;
            break;
          } catch (commitError) {
            console.warn(`Cloned repository doesn't contain expected commit ${expectedCommit}:`, commitError);
            // Continue to try other URLs
          }
        }
      } catch (error) {
        console.warn(`Failed to check/clone from ${cloneUrl}:`, error);
        lastError = error instanceof Error ? error : new Error('Unknown error');
        continue;
      }
    }

    // If we didn't find the expected commit, clone from the best URL we found
    if (!cloneSuccessful && bestCloneUrl) {
      if (expectedCommit) {
        console.log(`Expected commit ${expectedCommit} not found, cloning from: ${bestCloneUrl}`);
      } else {
        console.log(`Cloning from: ${bestCloneUrl}`);
      }

      try {
        await Promise.race([
          git.clone({
            fs: this.fs,
            http: this.httpForUrl(undefined),
            onAuth: this.onAuth,
            ...options,
            url: bestCloneUrl,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Clone timeout')), 30000)
          )
        ]);

        cloneSuccessful = true;
      } catch (error) {
        console.warn(`Failed to clone from ${bestCloneUrl}:`, error);
        lastError = error instanceof Error ? error : new Error('Unknown error');
      }
    }

    // If we couldn't find the specific commit or don't have state info, try regular cloning
    if (!cloneSuccessful) {
      console.log('Falling back to regular clone from available URLs');

      for (const cloneUrl of repo.httpsCloneUrls) {
        try {
          console.log(`Attempting to clone from: ${cloneUrl}`);

          await Promise.race([
            git.clone({
              fs: this.fs,
              http: this.httpForUrl(undefined),
              onAuth: this.onAuth,
              ...options,
              url: cloneUrl,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Clone timeout')), 30000)
            )
          ]);

          cloneSuccessful = true;
          break;
        } catch (error) {
          console.warn(`Failed to clone from ${cloneUrl}:`, error);
          lastError = error instanceof Error ? error : new Error('Unknown error');
          continue;
        }
      }
    }

    if (!cloneSuccessful) {
      throw lastError || new Error('All clone attempts failed');
    }

    // Construct the Nostr URI with relay if not already present
    const repoUrl = new NostrURI({
      ...nostrURI.toJSON(),
      relay: nostrURI.relay ?? repo.relays[0],
    });

    // After successful clone, update the remote to point to the Nostr URI
    await this.setRemoteURL({
      remote: options.remote || 'origin',
      dir: options.dir,
      url: repoUrl.toString(),
    });

    // Set the nostr.repo config to the naddr
    await this.setConfig({
      dir: options.dir,
      path: 'nostr.repo',
      value: nostrURI.toNaddr(),
    });

    // Validate the cloned repository against the expected state
    if (state && cloneSuccessful) {
      const validation = await this.validateRepositoryState(
        options.dir,
        expectedCommit,
        expectedBranch,
        repositoryRefs
      );

      if (validation.valid) {
        console.log('✓ Repository successfully cloned and validated against Nostr state');
      } else {
        console.warn('⚠ Repository cloned but validation warnings:');
        validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
      }
    } else if (cloneSuccessful) {
      console.log('✓ Repository cloned successfully (no state validation available)');
    }
  }

  async setRemoteURL(options: { dir: string; remote: string; url: string }): Promise<void> {
    // Remove the existing remote
    await git.deleteRemote({
      fs: this.fs,
      dir: options.dir,
      remote: options.remote,
    });

    // Add the remote with the new URL
    await git.addRemote({
      fs: this.fs,
      dir: options.dir,
      remote: options.remote,
      url: options.url,
    });
  }

  async getRemoteURL(dir: string, remote: string): Promise<string | null> {
    try {
      const remotes = await git.listRemotes({ fs: this.fs, dir });
      const remoteInfo = remotes.find(r => r.remote === remote);
      return remoteInfo?.url || null;
    } catch {
      return null;
    }
  }

  /**
   * Convert a local ref name to a remote tracking ref name assuming default remote refspec
   * @param remoteName The name of the remote (e.g., 'origin')
   * @param localRefName The local ref name (e.g., 'refs/heads/main')
   * @returns The remote tracking ref name (e.g., 'refs/remotes/origin/main')
   */
  private localRefToRemoteRef(remoteName: string, localRefName: string): string {
    if (localRefName === 'HEAD') {
      // map to the remote's symbolic HEAD (remote default branch pointer)
      return `refs/remotes/${remoteName}/HEAD`;
    }
    // Remove refs/heads/ prefix if present
    if (localRefName.startsWith('refs/heads/')) {
      const branchName = localRefName.substring('refs/heads/'.length);
      return `refs/remotes/${remoteName}/${branchName}`;
    }
    // For other refs (tags, etc.), construct the remote ref
    return `refs/remotes/${remoteName}/${localRefName.replace('refs/','')}`;
  }

  /**
   * Update remote tracking refs to match the Nostr state if git data present locally
   * @returns refs with missing data including HEAD, updated refs, and deleted stale refs
   */
  private async updateRemoteRefsToNostrState(
    state: RespositoryState,
    options: Omit<Parameters<typeof git.fetch>[0], 'fs' | 'http' | 'corsProxy'> & { remote: string; dir: string }
  ): Promise<{
    updated?: Record<string, string>,
    refsWithMissingData?: Record<string, string>,
    deleted?: string[],
   }> {
    // Get the remote name from options (passed from the fetch call)
    const remoteName = options.remote || 'origin';

    const refsWithMissingData: Record<string, string> = {};
    const updated: Record<string, string> = {};
    const entries = [
      ...Object.entries(state.refs),
      ...(state.HEAD ? [["HEAD", state.HEAD]] : [])
    ];
    for (const [refName, entry] of entries) {
      // update symbolic ref to use remote ref
      const value = entry.startsWith("ref: ") ? `ref: ${this.localRefToRemoteRef(remoteName, entry.slice(5))}` : entry;
      const isSymbolic = value.startsWith("ref: ");
      const refValue = isSymbolic ? value.slice(5) : value; // Remove "ref: " prefix for symbolic refs
      try {
        // Check if we have this commit locally
        try {
          const remoteRefName = this.localRefToRemoteRef(remoteName, refName);
          try {
            const existingValue = await git.resolveRef({
              fs: this.fs,
              dir: options.dir,
              ref:remoteRefName,
              depth: 1, // Don't resolve symbolic refs, just get the raw value
            });
            // update correct ref
            if (existingValue === refValue) continue;
          } catch {
            // ref doesnt exist yet
          }
          if (!isSymbolic) {
            // For non-symbolic refs, verify we have the commit locally
            await git.readCommit({
              fs: this.fs,
              dir: options.dir,
              // TODO handle annotated tags
              oid: refValue,
            });
          }
          // We have the commit (or it's a symbolic ref), update the remote tracking ref
          await git.writeRef({
            fs: this.fs,
            dir: options.dir,
            ref: remoteRefName,
            force: true, // standard behaviour of git fetch
            value: refValue,
            symbolic: isSymbolic, // Set symbolic flag for symbolic refs
          });
          console.log(`✓ Updated ${remoteRefName} to ${isSymbolic ? 'ref: ' : ''}${refValue}`);
          updated[refName] = entry;
        } catch (error) {
          refsWithMissingData[refName] = value;
          // We don't have this commit, need to fetch from the actual Git remote
          console.log(`⚠ Commit ${value} for ${refName} not found locally, need to fetch from Git remote. error: ${error}`);
        }
      } catch (error) {
        console.warn(`Failed to update ref ${refName}:`, error);
      }
    }

    // Delete local remote refs that don't exist in Repository State
    const deleted: string[] = [];
    try {
      // Get all local remote tracking refs for this remote
      const localRemoteRefs = await git.listRefs({
        fs: this.fs,
        dir: options.dir,
        filepath: `refs/remotes/${remoteName}`
      });

      // Build set of expected remote refs based on Repository State
      // This should match the same set of refs we iterated over above
      const expectedRemoteRefs = new Set<string>();
      for (const [refName] of entries) {
        expectedRemoteRefs.add(this.localRefToRemoteRef(remoteName, refName));
      }
      // Delete any local remote refs that don't exist in the Repository State
      for (const localRemoteRef of localRemoteRefs) {
        const fullRef = this.localRefToRemoteRef(remoteName, localRemoteRef);

        if (!expectedRemoteRefs.has(fullRef)) {
          try {
            await git.deleteRef({
              fs: this.fs,
              dir: options.dir,
              ref: fullRef,
            });
            console.log(`✓ Deleted stale remote ref ${localRemoteRef}`);
            deleted.push(localRemoteRef);
          } catch (error) {
            console.warn(`Failed to delete stale remote ref ${localRemoteRef}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to clean up stale remote refs:', error);
    }

    return {
      refsWithMissingData: Object.keys(refsWithMissingData).length > 0 ? refsWithMissingData : undefined,
      updated: Object.keys(updated).length > 0 ? updated : undefined,
      deleted: deleted.length > 0 ? deleted : undefined,
    }
  }

  /**
   * Get remote info for all clone URLs in a repository announcement.
   * Returns an array of results, each containing either the remote info or an error.
   */
  private async listFromCloneUrls(
    repo: RepositoryAnnouncement
  ): Promise<Array<{ cloneUrl: string; result: Awaited<ReturnType<typeof git.getRemoteInfo>> } | { cloneUrl: string; error: Error }>> {
    const results = await Promise.allSettled(
      repo.httpsCloneUrls.map(async (cloneUrl) => {
        try {
          const result = await git.getRemoteInfo({
            http: this.httpForUrl(undefined),
            onAuth: this.onAuth,
            url: cloneUrl,
          });
          return { cloneUrl, result };
        } catch (error) {
          throw { cloneUrl, error: error instanceof Error ? error : new Error(String(error)) };
        }
      })
    );

    return results.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // Extract the cloneUrl and error from the rejected promise
        const rejection = result.reason as { cloneUrl: string; error: Error };
        return { cloneUrl: rejection.cloneUrl, error: rejection.error };
      }
    });
  }

  /**
   * Identify differences between Nostr state and remote clone URL states
   * Returns a map of clone URLs to the changes needed to sync them with the Nostr state
   */
  private nostrIdentifyCloneUrlStateDifferences(
    nostrState: RespositoryState,
    remoteStates: Array<{ cloneUrl: string; result: Awaited<ReturnType<typeof git.getRemoteInfo>> } | { cloneUrl: string; error: Error }>
  ): Map<string, {
    refsToDelete: string[];      // Refs that exist on remote but not in Nostr state
    refsToUpdate: string[];      // Refs that exist in both but have different commits
    refsToCreate: string[];      // Refs that exist in Nostr state but not on remote
  }> {
    const differences = new Map<string, {
      refsToDelete: string[];
      refsToUpdate: string[];
      refsToCreate: string[];
    }>();

    for (const remoteState of remoteStates) {
      // Skip remotes that had errors
      if ('error' in remoteState) {
        console.log(`Skipping ${remoteState.cloneUrl} due to error: ${remoteState.error.message}`);
        continue;
      }

      const { cloneUrl, result } = remoteState;
      const changes = {
        refsToDelete: [] as string[],
        refsToUpdate: [] as string[],
        refsToCreate: [] as string[],
      };

      // Build a complete map of remote refs from heads and tags
      const remoteRefs: Record<string, string> = {};

      if (result.heads) {
        for (const [branch, commit] of Object.entries(result.heads)) {
          remoteRefs[`refs/heads/${branch}`] = commit;
        }
      }

      if (result.tags) {
        for (const [tag, commit] of Object.entries(result.tags)) {
          remoteRefs[`refs/tags/${tag}`] = commit;
        }
      }

      // Check for refs that need to be created or updated
      for (const [ref, nostrCommit] of Object.entries(nostrState.refs)) {
        const remoteCommit = remoteRefs[ref];

        if (!remoteCommit) {
          // Ref exists in Nostr state but not on remote - needs to be created
          changes.refsToCreate.push(ref);
        } else if (remoteCommit !== nostrCommit) {
          // Ref exists in both but points to different commits - needs to be updated
          changes.refsToUpdate.push(ref);
        }
      }

      // Check for refs that need to be deleted (exist on remote but not in Nostr state)
      for (const ref of Object.keys(remoteRefs)) {
        if (!nostrState.refs[ref]) {
          changes.refsToDelete.push(ref);
        }
      }

      // Only add to map if there are actual changes needed
      if (
        changes.refsToDelete.length > 0 ||
        changes.refsToUpdate.length > 0 ||
        changes.refsToCreate.length > 0
      ) {
        differences.set(cloneUrl, changes);
      }
    }

    return differences;
  }

  private async nostrFetch(nostrURI: NostrURI, options: Omit<Parameters<typeof git.fetch>[0], 'fs' | 'http' | 'corsProxy'> & { remote: string; dir: string }): Promise<FetchResult> {
    console.log(`Fetching updates from Nostr repository: ${nostrURI.toString()}`);

    // Fetch the latest repository state from Nostr
    const { repo, state, serversWithoutLatestAnnouncement, serversWithoutLatestState } = await this.fetchNostrRepoEvents(nostrURI);

    // If we have a state event, update our refs to match
    if (state) {
      const foundAllData = async (): Promise<FetchResult> => {
        // identify out-of-sync grasp servers are in sync
        const cloneURLsStates = await this.listFromCloneUrls(repo);
        const outOfSyncRefsPerCloneUrl = this.nostrIdentifyCloneUrlStateDifferences(state, cloneURLsStates);

        // Log out-of-sync remotes for debugging
        if (outOfSyncRefsPerCloneUrl.size > 0) {
          console.log(`Found ${outOfSyncRefsPerCloneUrl.size} out-of-sync clone URLs:`);
          for (const [cloneUrl, changes] of outOfSyncRefsPerCloneUrl.entries()) {
            console.log(`  ${cloneUrl}:`, {
              toDelete: changes.refsToDelete.length,
              toUpdate: changes.refsToUpdate.length,
              toCreate: changes.refsToCreate.length,
            });
          }
        }

        // Sync GRASP servers (send announcement and state events and push git ref state updates)
        await this.nostrSyncNostrGitServers(
          repo,
          state,
          outOfSyncRefsPerCloneUrl,
          serversWithoutLatestAnnouncement || [],
          serversWithoutLatestState || [],
          options.dir
        );

        return {
          fetchHead: state.headCommit || null,
          fetchHeadDescription: `Fetched from Nostr repository state`,
          defaultBranch: state.headBranch || null,
        };
      };

      let {updated, refsWithMissingData} = await this.updateRemoteRefsToNostrState(state,options);

      if (updated) {
        console.log(`Updating repository state from Nostr: HEAD=${state.HEAD}, refs=${Object.keys(state.refs).length}`);

      }
      // If we updated refs but some commits are missing, try to fetch from Git remotes
      if (refsWithMissingData) {
        console.log(`Updating repository state from Nostr: HEAD=${state.HEAD}, refs=${Object.keys(state.refs).length}`);

        if (repo.httpsCloneUrls.length === 0) {
          throw new Error('No Git clone URLs available for fetching');
        }

        // TODO - we could be more targeted at selecting the remote with all the misssing refs instead of trying 1 by 1.
        for (const cloneUrl of repo.httpsCloneUrls) {
          console.log(refsWithMissingData)
          console.log(`Fetching missing commits from: ${cloneUrl}`);
          try {
            // TODO we are just branches and tags so we will miss any other refs in state event
            await this.nostrFetchDataFromGitRemote(cloneUrl, options.dir);
            const result = await this.updateRemoteRefsToNostrState(state,options);
            if (updated || result.updated) updated = { ...(updated || {}), ...(result.updated || {}) }; // merge
            refsWithMissingData = result.refsWithMissingData; // Replace refsWithMissingData
          } catch (error) {
            console.log(`Failed to fetch missing commits from: ${cloneUrl} error: ${error}`);
          }
          if (!refsWithMissingData) return await foundAllData();
        }
        // TODO can we report on partially successfuly fetch? (if some refs were updated but some data not found eg for tags?)
        throw new Error(`failed to find git data on clone urls for the following refs in Nostr state event: ${Object.keys(refsWithMissingData).join(", ")}`)
      } else {
        return await foundAllData();
      }
    } else {
      // No state event, try to fetch from the Git clone URLs
      console.log('No repository state found on Nostr, checking for updates from Git remotes');
      if (repo.httpsCloneUrls.length === 0) {
        throw new Error('No Git clone URLs available for fetching');
      }
      // we could catch the error and try the next clone url but that is too risky.
      // if the other servers aren't in sync it would give us an state with lots of non-fast-foward changes to resolve, only to revert back to the  first priority server next time it is available.
      return await this.nostrFetchDataFromGitRemote(repo.httpsCloneUrls[0], options.dir);
    }
  }

  private async nostrPull(nostrURI: NostrURI, options: Omit<Parameters<typeof git.pull>[0], 'fs' | 'http' | 'corsProxy'> & { remote: string; dir: string }): Promise<void> {
    // First, fetch the latest state
    const fetchResult = await this.nostrFetch(nostrURI, options);

    // Get the current branch
    const currentBranch = await git.currentBranch({ fs: this.fs, dir: options.dir });

    if (!currentBranch) {
      throw new Error('Cannot pull: not on any branch (detached HEAD)');
    }

    // Check if we can fast-forward
    const currentCommit = await git.resolveRef({
      fs: this.fs,
      dir: options.dir,
      ref: 'HEAD',
    });

    const upstreamRef = `refs/remotes/${options.remote}/${currentBranch}`;
    let upstreamCommit: string;

    try {
      upstreamCommit = await git.resolveRef({
        fs: this.fs,
        dir: options.dir,
        ref: upstreamRef,
      });
    } catch {
      // No upstream tracking branch, use fetchHead if available
      if (fetchResult.fetchHead) {
        upstreamCommit = fetchResult.fetchHead;
      } else {
        throw new Error(`No upstream branch found for ${currentBranch}`);
      }
    }

    // Check if we're already up to date
    if (currentCommit === upstreamCommit) {
      console.log('Already up to date');
      return;
    }

    // Check if we can fast-forward (current commit should be ancestor of upstream)
    const canFastForward = await git.isDescendent({
      fs: this.fs,
      dir: options.dir,
      oid: upstreamCommit,
      ancestor: currentCommit,
    }).catch(() => false);

    if (canFastForward) {
      // Fast-forward merge by updating the branch ref
      await git.writeRef({
        fs: this.fs,
        dir: options.dir,
        ref: `refs/heads/${currentBranch}`,
        value: upstreamCommit,
        force: true,
      });

      // Update the working directory
      await git.checkout({
        fs: this.fs,
        dir: options.dir,
        ref: currentBranch,
        force: true,
      });

      console.log(`Fast-forwarded ${currentBranch} to ${upstreamCommit}`);
    } else {
      // Need to merge
      const mergeResult = await git.merge({
        fs: this.fs,
        dir: options.dir,
        ours: currentCommit,
        theirs: upstreamCommit,
        message: `Merge remote-tracking branch '${options.remote}/${currentBranch}' from Nostr`,
        author: options.author,
      });

      if (mergeResult.alreadyMerged) {
        console.log('Already up to date');
      } else {
        console.log(`Merged ${upstreamCommit} into ${currentBranch}`);
      }
    }
  }

  private async nostrPush(nostrURI: NostrURI, options: Omit<Parameters<typeof git.push>[0], 'fs' | 'http' | 'onAuth' | 'corsProxy'>) {
    if (!this.signer) {
      throw new Error('Nostr signer is required for pushing to Nostr repositories');
    }

    const dir = options.dir || '.';
    const ref = options.ref || 'HEAD';
    const remoteRef = options.remoteRef || ref;
    const force = options.force || false;

    console.log(`Pushing to Nostr repository: ${nostrURI.toString()}`);

    // Fetch the repository announcement and state to get relay information and current remote state
    // Also check which servers don't have the latest announcement
    const {
      repo,
      state,
      serversWithoutAnnouncement = [],
      serversWithoutLatestAnnouncement = [],
      serversWithErrors = []
    } = await this.fetchNostrRepoEvents(nostrURI);
    if (!repo) {
      throw new Error('Repository announcement not found on Nostr network');
    }

    // If we have a state event and --force was not used, check if fast-forward is possible.
    // we cant let the server do this as we publish the state update first
    if (state && !force) {
      const remoteRefName = remoteRef.startsWith('refs/') ? remoteRef : `refs/heads/${remoteRef}`;
      const remoteCommit = state.refs[remoteRefName];

      if (remoteCommit) {
        console.log(`Checking fast-forward: remote ${remoteRefName} is at ${remoteCommit}`);

        // Get the local commit we're trying to push
        let localCommit: string;
        try {
          localCommit = await git.resolveRef({
            fs: this.fs,
            dir,
            ref,
          });
        } catch (error) {
          throw new Error(`Failed to resolve local ref ${ref}: ${error}`);
        }

        console.log(`Local ref ${ref} is at ${localCommit}`);

        // If commits are the same, we're already up to date
        if (localCommit === remoteCommit) {
          console.log('Everything up-to-date');
          return;
        }

        // Check if local commit is a descendant of remote commit (fast-forward possible)
        let canFastForward: boolean;
        try {
          canFastForward = await git.isDescendent({
            fs: this.fs,
            dir,
            oid: localCommit,
            ancestor: remoteCommit,
          });
        } catch (error) {
          // If we can't determine ancestry, allow the push to proceed
          // (the Git server will do its own validation)
          console.warn(`Could not determine if fast-forward is possible: ${error}`);
          canFastForward = true;
        }

        if (!canFastForward) {
          throw new Error(
            `Updates were rejected because the remote contains work that you do\n` +
            `not have locally. This is usually caused by another repository pushing\n` +
            `to the same ref. You may want to first integrate the remote changes\n` +
            `(e.g., 'git pull ...') before pushing again.\n` +
            `See the 'Note about fast-forwards' in 'git push --help' for details.`
          );
        }

        console.log('✓ Fast-forward check passed');
      }
    }

    // Extract relay URLs and clone URLs from the repository announcement
    const relayUrls: string[] = [ ...(repo.relays) ?? []];

    // If no relays specified in announcement, use default git-focused relays
    if (relayUrls.length === 0) {
      relayUrls.push(
        'wss://git.shakespeare.diy/',
        'wss://relay.ngit.dev/',
        'wss://relay.nostr.band/'
      );
    }

    // Determine which servers need the announcement published
    const serversNeedingAnnouncement = [
      ...serversWithoutAnnouncement,
      ...serversWithoutLatestAnnouncement
    ];

    if (serversNeedingAnnouncement.length > 0) {
      console.log(`Publishing announcement to ${serversNeedingAnnouncement.length} servers:`);
      if (serversWithoutAnnouncement.length > 0) {
        console.log(`  - Without announcement: ${serversWithoutAnnouncement.join(', ')}`);
      }
      if (serversWithoutLatestAnnouncement.length > 0) {
        console.log(`  - With outdated announcement: ${serversWithoutLatestAnnouncement.join(', ')}`);
      }
      if (serversWithErrors.length > 0) {
        console.log(`  - With errors (skipping): ${serversWithErrors.join(', ')}`);
      }

      // Publish the announcement to servers that need it
      const serversToPublish = serversNeedingAnnouncement.map(server => `wss://${server}/`);
      try {
        await this.nostr.group(serversToPublish).event(repo.event);
        console.log('✓ Repository announcement published to servers');
      } catch (error) {
        console.warn('Failed to publish announcement to some servers:', error);
      }
    }

    // Update or create repository state
    let stateEvent: NostrEvent;

    if (state) {
      // We have an existing state event - update it with the new ref

      // Get the commit we're pushing
      let localCommit: string;
      try {
        localCommit = await git.resolveRef({
          fs: this.fs,
          dir,
          ref,
        });
      } catch (error) {
        throw new Error(`Failed to resolve local ref ${ref}: ${error}`);
      }

      // Apply push changes and create updated event
      stateEvent = await this.applyPushAndUpdateStateEvent(state, remoteRef, localCommit, this.signer);
    } else {
      // No existing state event - create initial state from repository
      stateEvent = await this.createInitialRepositoryState(dir, nostrURI.identifier, this.signer);
    }

    // Publish the state event to Nostr relays
    console.log(`Publishing repository state to ${relayUrls.length} relays`);

    try {
      await this.nostr.group(relayUrls).event(stateEvent);
      console.log('✓ Repository state published to Nostr successfully');
    } catch (error) {
      console.warn('Failed to publish repository state to some relays:', error);
      // Continue with Git push even if Nostr publishing partially fails
    }

    // Push to each clone URL
    if (repo.httpsCloneUrls.length === 0) {
      console.warn('No Git https clone URLs found in repository announcement');
      return;
    }

    // Only wait 5 seconds if we had to publish the announcement to servers
    if (serversNeedingAnnouncement.length > 0) {
      console.log('Waiting 5 seconds for GRASP servers to process announcement...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    let pushSuccessful = false;
    let lastError: Error | null = null;

    for (const cloneUrl of repo.httpsCloneUrls) {
      console.log(`Pushing to Git remote: ${cloneUrl}`);

      try {
        await git.push({
          fs: this.fs,
          http: this.httpForUrl(undefined),
          onAuth: this.onAuth,
          dir,
          url: cloneUrl,
          ...options,
        });

        pushSuccessful = true;
        console.log(`✓ Successfully pushed to ${cloneUrl}`);
      } catch (pushError) {
        console.warn(`Failed to push to ${cloneUrl}:`, pushError);
        lastError = pushError instanceof Error ? pushError : new Error('Unknown push error');
      }
    }

    if (!pushSuccessful) {
      throw lastError || new Error('All push attempts failed');
    }

    console.log('✓ Nostr push completed successfully');
  }

  /* just fetching the branches and tags so some refs (eg refs/nostr/<event-id>) wont be fetched (unless the remote refspec specifies?) */
  private async nostrFetchDataFromGitRemote(httpsCloneUrl:string, dir: string): Promise<FetchResult> {
    try {
      console.log(`Fetching from Git remote: ${httpsCloneUrl}`);

      // Fetch from the temporary remote
      const fetchResult = await git.fetch({
        fs: this.fs,
        http: this.httpForUrl(undefined),
        onAuth: this.onAuth,
        dir,
        tags: true,
        url: httpsCloneUrl,
      });

      return {
        fetchHead: fetchResult.fetchHead || null,
        fetchHeadDescription: `Fetched from Git remote: ${httpsCloneUrl}`,
        defaultBranch: fetchResult.defaultBranch || null,
      };
    } catch (error) {
      console.warn(`Failed to fetch from ${httpsCloneUrl}:`, error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  }

  /**
   * Publish announcement and state events to Nostr servers that need them
   * Returns sets of server hostnames where publishing was successful and failed
   */
  private async nostrSyncPublishAnnAndStateEventsToServers(
    repo: RepositoryAnnouncement,
    state: RespositoryState,
    serversWithoutLatestAnnouncement: string[],
    serversWithoutLatestState: string[]
  ): Promise<{ successfulServers: Set<string>; failedServers: Set<string> }> {
    // Categorize servers by what they need
    const serversWithoutLatestAnnouncementSet = new Set(serversWithoutLatestAnnouncement);
    const serversWithoutLatestStateSet = new Set(serversWithoutLatestState);

    const serversNeedingOnlyAnnouncement = serversWithoutLatestAnnouncement.filter(
      server => !serversWithoutLatestStateSet.has(server)
    );
    const serversNeedingOnlyState = serversWithoutLatestState.filter(
      server => !serversWithoutLatestAnnouncementSet.has(server)
    );
    const serversNeedingBoth = serversWithoutLatestAnnouncement.filter(
      server => serversWithoutLatestStateSet.has(server)
    );

    // Track successful and failed servers
    const successfulServers = new Set<string>();
    const failedServers = new Set<string>();

    // Dedupe servers that need events
    const serversNeedingEvents = new Set<string>([
      ...serversWithoutLatestAnnouncement,
      ...serversWithoutLatestState,
    ]);

    if (serversNeedingEvents.size === 0) {
      return { successfulServers, failedServers };
    }

    console.log(`Syncing events to ${serversNeedingEvents.size} out-of-sync servers`);

    const publishPromises: Promise<void>[] = [];

    // Publish only announcement to servers that need just announcement
    if (serversNeedingOnlyAnnouncement.length > 0) {
      const urls = serversNeedingOnlyAnnouncement.map(server => `wss://${server}/`);
      publishPromises.push(
        this.nostr.group(urls).event(repo.event)
          .then(() => {
            console.log(`✓ Published announcement to ${serversNeedingOnlyAnnouncement.length} servers`);
            serversNeedingOnlyAnnouncement.forEach(server => successfulServers.add(server));
          })
          .catch(error => {
            console.warn('Failed to publish announcement to some servers:', error);
            serversNeedingOnlyAnnouncement.forEach(server => failedServers.add(server));
          })
      );
    }

    // Publish only state to servers that need just state
    if (serversNeedingOnlyState.length > 0) {
      const urls = serversNeedingOnlyState.map(server => `wss://${server}/`);
      publishPromises.push(
        this.nostr.group(urls).event(state.event)
          .then(() => {
            console.log(`✓ Published state to ${serversNeedingOnlyState.length} servers`);
            serversNeedingOnlyState.forEach(server => successfulServers.add(server));
          })
          .catch(error => {
            console.warn('Failed to publish state to some servers:', error);
            serversNeedingOnlyState.forEach(server => failedServers.add(server));
          })
      );
    }

    // Publish both announcement and state to servers that need both
    if (serversNeedingBoth.length > 0) {
      const urls = serversNeedingBoth.map(server => `wss://${server}/`);
      publishPromises.push(
        Promise.all([
          this.nostr.group(urls).event(repo.event),
          this.nostr.group(urls).event(state.event),
        ])
          .then(() => {
            console.log(`✓ Published announcement and state to ${serversNeedingBoth.length} servers`);
            serversNeedingBoth.forEach(server => successfulServers.add(server));
          })
          .catch(error => {
            console.warn('Failed to publish events to some servers:', error);
            serversNeedingBoth.forEach(server => failedServers.add(server));
          })
      );
    }

    // Wait for all publish operations to complete
    await Promise.all(publishPromises);

    return { successfulServers, failedServers };
  }

  /**
   * Synchronize Nostr Git servers with the latest repository state and announcement
   * Publishes events to out-of-sync servers and pushes ref changes to GRASP servers
   */
  private async nostrSyncNostrGitServers(
    repo: RepositoryAnnouncement,
    state: RespositoryState,
    outOfSyncRefsPerCloneUrl: Map<string, { refsToDelete: string[]; refsToUpdate: string[]; refsToCreate: string[] }>,
    serversWithoutLatestAnnouncement: string[],
    serversWithoutLatestState: string[],
    dir: string
  ): Promise<void> {
    // Publish events to servers and get the set of successful and failed servers
    const { successfulServers, failedServers } = await this.nostrSyncPublishAnnAndStateEventsToServers(
      repo,
      state,
      serversWithoutLatestAnnouncement,
      serversWithoutLatestState
    );

    // Log event publishing results
    if (successfulServers.size > 0) {
      console.log(`✓ Successfully published events to ${successfulServers.size} server(s)`);
    }
    if (failedServers.size > 0) {
      console.log(`✗ Failed to publish events to ${failedServers.size} server(s)`);
    }

    // Filter out clone URLs that are not GRASP servers (only sync GRASP servers)
    // Also filter out servers where event publishing failed (when events were required)
    const graspServerOutOfSyncRefs = new Map<string, { refsToDelete: string[]; refsToUpdate: string[]; refsToCreate: string[] }>();

    for (const [cloneUrl, changes] of outOfSyncRefsPerCloneUrl.entries()) {
      // Extract hostname from clone URL to check if it failed
      const hostname = new URL(cloneUrl).hostname;

      // Skip non-GRASP servers
      if (repo.nonGraspHttpsCloneUrls.includes(cloneUrl)) {
        continue;
      }

      // Only filter out servers where event publishing actually failed
      // (Some servers might not require events but still need git ref updates)
      if (failedServers.has(hostname)) {
        console.log(`Skipping ${cloneUrl} - event publishing failed`);
        continue;
      }

      // Include this GRASP server for syncing
      graspServerOutOfSyncRefs.set(cloneUrl, changes);
    }

    // Push ref changes to GRASP servers that are out of sync
    if (graspServerOutOfSyncRefs.size > 0) {
      console.log(`Pushing ref changes to ${graspServerOutOfSyncRefs.size} out-of-sync GRASP servers`);

      for (const [cloneUrl, changes] of graspServerOutOfSyncRefs.entries()) {
        try {
          console.log(`Syncing ${cloneUrl}:`, {
            toDelete: changes.refsToDelete.length,
            toUpdate: changes.refsToUpdate.length,
            toCreate: changes.refsToCreate.length,
          });

          // Push all refs that need to be created or updated
          const refsToPush = [...changes.refsToCreate, ...changes.refsToUpdate];

          if (refsToPush.length > 0) {
            for (const ref of refsToPush) {
              try {
                await git.push({
                  fs: this.fs,
                  http: this.httpForUrl(undefined),
                  onAuth: this.onAuth,
                  dir,
                  url: cloneUrl,
                  ref,
                  force: true, // Force push to ensure refs are updated
                });
                console.log(`  ✓ Pushed ${ref}`);
              } catch (pushError) {
                console.warn(`  ✗ Failed to push ${ref}:`, pushError);
              }
            }
          }

          // Delete refs that should not exist on the remote
          // Note: Git push with :ref syntax deletes remote refs
          if (changes.refsToDelete.length > 0) {
            for (const ref of changes.refsToDelete) {
              try {
                await git.push({
                  fs: this.fs,
                  http: this.httpForUrl(undefined),
                  onAuth: this.onAuth,
                  dir,
                  url: cloneUrl,
                  ref: `:${ref}`, // :ref syntax deletes the remote ref
                });
                console.log(`  ✓ Deleted ${ref}`);
              } catch (deleteError) {
                console.warn(`  ✗ Failed to delete ${ref}:`, deleteError);
              }
            }
          }

          console.log(`✓ Synced ${cloneUrl}`);
        } catch (error) {
          console.warn(`Failed to sync ${cloneUrl}:`, error);
        }
      }
    }
  }
}

class GitHttp implements HttpClient {
  private proxy?: string;

  constructor(proxy?: string) {
    this.proxy = proxy;
  }

  async request(request: GitHttpRequest): Promise<GitHttpResponse> {
    const method = request.method ?? "GET";
    const url = new URL(request.url);

    const target = this.proxy
      ? proxyUrl(this.proxy, url)
      : url.href;

    const init: RequestInit = {
      method,
      headers: request.headers,
    };

    if (request.body) {
      const buffered = await collectToUint8Array(request.body);
      init.body = new Blob([new Uint8Array(buffered)]);
    }

    const response = await fetch(target, init);
    const headers = Object.fromEntries(response.headers.entries());
    const body = response.body ? readableStreamToAsyncIterator(response.body) : undefined;

    return {
      url: response.url,
      method,
      statusCode: response.status,
      statusMessage: response.statusText,
      body,
      headers,
    };
  }
}

// Drain an async iterable of Uint8Array into one Uint8Array
async function collectToUint8Array(
  src: AsyncIterable<Uint8Array> | AsyncIterableIterator<Uint8Array>
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of src) {
    chunks.push(chunk);
    total += chunk.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

// Portable async iterator over a ReadableStream (works even if
// ReadableStream doesn't implement [Symbol.asyncIterator])
function readableStreamToAsyncIterator(
  stream: ReadableStream<Uint8Array>
): AsyncIterableIterator<Uint8Array> {
  const reader = stream.getReader();
  return {
    async next() {
      const { value, done } = await reader.read();
      return done ? { value: undefined, done: true } : { value, done: false };
    },
    async return() {
      try {
        await reader.cancel();
      } catch {
        // Ignore cancel errors
      }
      return { value: undefined, done: true };
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

interface RespositoryState {
  event: NostrEvent;
  HEAD?: string;
  headCommit?: string;
  headBranch?: string;
  refs: Record<string, string>;
}

/**
 * Parse repository state information from a NIP-34 repository state event
 */
function parseRepositoryState(stateEvent: NostrEvent): RespositoryState {
  const refs: Record<string, string> = {};
  let HEAD: string | undefined;
  let headCommit: string | undefined;
  let headBranch: string | undefined;

  for (const [name, value] of stateEvent.tags) {
    if (name === 'HEAD' && value) {
      HEAD = value;

      // Parse HEAD reference to extract branch name
      if (value.startsWith('ref: refs/heads/')) {
        headBranch = value.slice(16); // Remove "ref: refs/heads/" prefix
      }
    } else if (name.startsWith('refs/') && value) {
      refs[name] = value;

      // If this ref matches the HEAD, store the commit
      if (HEAD === `ref: ${name}`) {
        headCommit = value;
      }
    }
  }

  return { event: stateEvent, HEAD, headCommit, headBranch, refs };
}