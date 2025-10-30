import git, { GitHttpRequest, GitHttpResponse, HttpClient } from 'isomorphic-git';
import { NIP05 } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';
import { proxyUrl } from './proxyUrl';
import { readGitSettings } from './configUtils';
import type { NostrEvent, NostrSigner, NPool } from '@nostrify/nostrify';
import type { JSRuntimeFS } from './JSRuntime';

export interface GitOptions {
  fs: JSRuntimeFS;
  nostr: NPool;
  corsProxy?: string;
  ngitServers?: string[];
}

interface NostrCloneURI {
  pubkey: string;
  d: string;
  relay?: string;
}

/**
 * Git class that wraps isomorphic-git and provides a cleaner interface.
 * Instantiate with an fs implementation, optional corsProxy string, and optional corsProxyRegex.
 * All methods have the same names as isomorphic-git but don't require
 * passing fs, http, and corsProxy each time.
 */
export class Git {
  private fs: JSRuntimeFS;
  private http: HttpClient;
  private nostr: NPool;
  private ngitServers: string[];

  constructor(options: GitOptions) {
    this.fs = options.fs;
    this.http = new GitHttp(options.corsProxy);
    this.nostr = options.nostr;
    this.ngitServers = options.ngitServers ?? ['git.shakespeare.diy', 'relay.ngit.dev'];
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
      const nostrURI = await this.parseNostrCloneURI(options.url);
      if (!nostrURI) {
        throw new Error('Invalid Nostr clone URI format');
      }
      // Try cloning from Nostr
      return this.nostrClone(nostrURI, options);
    }

    // Regular Git URL
    return git.clone({
      fs: this.fs,
      http: this.http,
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
  async commit(options: Omit<Parameters<typeof git.commit>[0], 'fs'>) {
    // If author is not provided, use Git identity settings
    let author = options.author;
    let committer = options.committer;
    let message = options.message;

    if (!author || !committer) {
      // Read Git identity settings from config
      const gitSettings = await readGitSettings(this.fs);

      // Determine author based on Git identity settings
      const defaultAuthor = {
        name: 'shakespeare.diy',
        email: 'assistant@shakespeare.diy',
      };

      const hasCustomIdentity = gitSettings.name && gitSettings.email;

      if (hasCustomIdentity) {
        const customAuthor = {
          name: gitSettings.name!,
          email: gitSettings.email!,
        };

        // Use custom identity
        if (!author) author = customAuthor;
        if (!committer) committer = customAuthor;

        // Add Shakespeare as co-author if enabled
        if (gitSettings.coAuthorEnabled ?? true) {
          message = `${message}\n\nCo-authored-by: shakespeare.diy <assistant@shakespeare.diy>`;
        }
      } else {
        // Use Shakespeare as default author
        if (!author) author = defaultAuthor;
        if (!committer) committer = defaultAuthor;
      }
    }

    return git.commit({
      fs: this.fs,
      ...options,
      author,
      committer,
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
      return this.getNostrRemoteInfo(options.url);
    }

    return git.getRemoteInfo({
      http: this.http,
      ...options,
    });
  }

  async fetch(options: Omit<Parameters<typeof git.fetch>[0], 'fs' | 'http' | 'corsProxy'>) {
    // Check if this is a Nostr repository by looking at the remote URL
    const remote = options.remote || 'origin';
    const dir = options.dir || '.';
    const remoteUrl = await this.getRemoteURL(dir, remote);

    if (remoteUrl && remoteUrl.startsWith('nostr://')) {
      return this.nostrFetch(remoteUrl, { ...options, remote, dir });
    }

    // Regular Git fetch
    return git.fetch({
      fs: this.fs,
      http: this.http,
      ...options,
    });
  }

  async pull(options: Omit<Parameters<typeof git.pull>[0], 'fs' | 'http' | 'corsProxy'>) {
    // Check if this is a Nostr repository by looking at the remote URL
    const remote = options.remote || 'origin';
    const dir = options.dir || '.';
    const remoteUrl = await this.getRemoteURL(dir, remote);

    if (remoteUrl && remoteUrl.startsWith('nostr://')) {
      return this.nostrPull(remoteUrl, { ...options, remote, dir });
    }

    // Regular Git pull
    return git.pull({
      fs: this.fs,
      http: this.http,
      ...options,
    });
  }

  async push(options: Omit<Parameters<typeof git.push>[0], 'fs' | 'http' | 'corsProxy'> & { signer?: NostrSigner }) {
    // Check if this is a Nostr repository by looking at the remote URL
    const remote = options.remote || 'origin';
    const dir = options.dir || '.';
    const remoteUrl = await this.getRemoteURL(dir, remote);

    if (remoteUrl && remoteUrl.startsWith('nostr://')) {
      if (!options.signer) {
        throw new Error('Nostr signer is required for pushing to Nostr repositories');
      }
      return this.nostrPush(remoteUrl, { ...options, remote, dir: dir, signer: options.signer });
    }

    return git.push({
      fs: this.fs,
      http: this.http,
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
  async merge(options: Omit<Parameters<typeof git.merge>[0], 'fs'>) {
    return git.merge({
      fs: this.fs,
      ...options,
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
      http: this.http,
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
      http: this.http,
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

  // Nostr-specific helper methods

  /**
   * Get remote info for a Nostr repository URI
   */
  private async getNostrRemoteInfo(nostrUrl: string): Promise<{
    capabilities: string[];
    refs: Record<string, string>;
    HEAD?: string;
  }> {
    // Parse the Nostr URI
    const nostrURI = await this.parseNostrCloneURI(nostrUrl);
    if (!nostrURI) {
      throw new Error('Invalid Nostr URI format');
    }

    console.log(`Getting remote info for Nostr repository: ${nostrUrl}`);

    // Fetch the repository announcement and state from Nostr
    const { repo, state } = await this.fetchNostrRepo(nostrURI);

    if (!repo) {
      throw new Error('Repository announcement not found on Nostr network');
    }

    // Extract refs from the state event if available
    const refs: Record<string, string> = {};
    let HEAD: string | undefined;

    if (state) {
      const stateInfo = this.extractRepositoryState(state);

      // Add all refs from the state
      Object.assign(refs, stateInfo.refs);

      // Set HEAD
      if (stateInfo.HEAD) {
        HEAD = stateInfo.HEAD;
      }
    } else {
      // No state event, try to get info from the first available clone URL
      const cloneUrls = getCloneURLs(repo);

      if (cloneUrls.length > 0) {
        // Try to get remote info from the first clone URL
        try {
          const gitRemoteInfo = await git.getRemoteInfo({
            http: this.http,
            url: cloneUrls[0],
          });

          Object.assign(refs, gitRemoteInfo.refs);
          HEAD = gitRemoteInfo.HEAD;
        } catch (error) {
          console.warn(`Failed to get remote info from ${cloneUrls[0]}:`, error);
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
   * Get current repository state for creating a NIP-34 repository state event
   */
  private async getCurrentRepositoryState(dir: string): Promise<{
    refTags: string[][];
    headRef?: string;
  }> {
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
      return { refTags, headRef };
    } catch (error) {
      console.error('Failed to get repository state:', error);
      throw new Error(`Failed to get repository state: ${error}`);
    }
  }

  /**
   * Extract repository state information from a NIP-34 repository state event
   */
  private extractRepositoryState(stateEvent: NostrEvent): {
    HEAD?: string;
    headCommit?: string;
    headBranch?: string;
    refs: Record<string, string>;
  } {
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

    return { HEAD, headCommit, headBranch, refs };
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

  private async parseNostrCloneURI(uri: string): Promise<NostrCloneURI | null> {
    try {
      if (!uri.startsWith('nostr://')) {
        return null;
      }

      const path = uri.slice(8); // Remove 'nostr://' prefix
      const parts = path.split('/');

      if (parts.length < 2) {
        return null;
      }

      const identifier = parts[0];
      let pubkey: string;

      // Try to decode as npub first, otherwise assume it's already a hex pubkey
      try {
        const decoded = nip19.decode(identifier);
        if (decoded.type === 'npub') {
          pubkey = decoded.data;
        } else {
          return null;
        }
      } catch {
        // If decoding fails, check if it's a NIP-05 identifier
        if (identifier.split('@').length === 2) {
          const pointer = await NIP05.lookup(identifier, {
            signal: AbortSignal.timeout(3000),
          });
          pubkey = pointer.pubkey;
        } else {
          return null;
        }
      }

      // Check if we have relay and d-tag or just d-tag
      if (parts.length === 3) {
        // Format: nostr://npub/relay/d
        return {
          pubkey,
          relay: `wss://${parts[1]}/`,
          d: parts[2],
        };
      } else if (parts.length === 2) {
        // Format: nostr://npub/d
        return {
          pubkey,
          d: parts[1],
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  private async fetchNostrRepo(nostrURI: NostrCloneURI): Promise<{ repo?: NostrEvent; state?: NostrEvent }> {
    // Build the filter for both NIP-34 repository announcement and state events
    const filter = {
      kinds: [30617, 30618],
      authors: [nostrURI.pubkey],
      '#d': [nostrURI.d],
    };

    const gitRelays = this.ngitServers.map(server => `wss://${server}/`);

    let events: NostrEvent[] = [];

    // Try the specified relay first, then fall back to known Git relays
    if (nostrURI.relay) {
      try {
        events = await this.nostr.relay(nostrURI.relay).query([filter], { signal: AbortSignal.timeout(1000) });
      } catch (error) {
        console.error(`Error querying relay ${nostrURI.relay}: ${error}`);
      }
    }
    if (!events.length) {
      try {
        events = await this.nostr.group(gitRelays).query([filter], { signal: AbortSignal.timeout(5000) });
      } catch (error) {
        console.error(`Error querying group relays: ${error}`);
      }
    }
    if (!events.length) {
      throw new Error('No events found for the specified Nostr repository');
    }

    const repo = events.find((e) => e.kind === 30617);
    const state = events.find((e) => e.kind === 30618);

    if (!repo) {
      throw new Error('Repository announcement not found on Nostr network');
    }

    if (state) {
      console.log(`Found repository state event with ${state.tags.length} tags`);
    } else {
      console.log('No repository state event found, proceeding with basic clone');
    }

    return { repo, state };
  }

  private async nostrClone(nostrURI: NostrCloneURI, options: Omit<Parameters<typeof git.clone>[0], 'fs' | 'http' | 'corsProxy'>): Promise<void> {
    // Fetch events from Nostr
    const { repo, state } = await this.fetchNostrRepo(nostrURI);

    if (!repo) {
      throw new Error('Repository not found');
    }

    // Extract repository state information if available
    let expectedCommit: string | undefined;
    let expectedBranch: string | undefined;
    let repositoryRefs: Record<string, string> = {};

    if (state) {
      const stateInfo = this.extractRepositoryState(state);
      expectedCommit = stateInfo.headCommit;
      expectedBranch = stateInfo.headBranch;
      repositoryRefs = stateInfo.refs;

      console.log(`Repository state: HEAD=${stateInfo.HEAD}, commit=${expectedCommit}, branch=${expectedBranch}`);
      console.log(`Available refs:`, Object.keys(repositoryRefs));
    }

    // Collect valid clone URLs from the repo event tags
    const cloneUrls = getCloneURLs(repo);

    if (cloneUrls.length === 0) {
      throw new Error('No valid clone URLs found in repository announcement');
    }

    let lastError: Error | null = null;
    let cloneSuccessful = false;

    // If we have state information, try to find a clone URL that contains the expected commit
    if (expectedCommit) {
      console.log(`Looking for repository with commit: ${expectedCommit}`);

      for (const cloneUrl of cloneUrls) {
        try {
          console.log(`Checking remote info for: ${cloneUrl}`);

          // Get remote repository information to check if it has the expected commit
          const remoteInfo = await Promise.race([
            git.getRemoteInfo({
              http: this.http,
              url: cloneUrl,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Remote info timeout')), 10000)
            )
          ]);

          // Check if the expected commit exists in any of the remote refs
          const hasExpectedCommit = Object.values(remoteInfo.refs).includes(expectedCommit);

          if (hasExpectedCommit) {
            console.log(`Found expected commit ${expectedCommit} in ${cloneUrl}`);

            // Clone from this URL since it has the expected commit
            await Promise.race([
              git.clone({
                fs: this.fs,
                http: this.http,
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
                    force: true,
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
    }

    // If we couldn't find the specific commit or don't have state info, try regular cloning
    if (!cloneSuccessful) {
      console.log('Falling back to regular clone from available URLs');

      for (const cloneUrl of cloneUrls) {
        try {
          console.log(`Attempting to clone from: ${cloneUrl}`);

          await Promise.race([
            git.clone({
              fs: this.fs,
              http: this.http,
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

    // After successful clone, update the origin remote to point to the Nostr URI
    await this.setRemoteURL({
      remote: 'origin',
      dir: options.dir,
      url: options.url,
    });

    // Set the nostr.repo config to the naddr
    await this.setConfig({
      dir: options.dir,
      path: 'nostr.repo',
      value: nip19.naddrEncode({
        kind: 30617,
        pubkey: nostrURI.pubkey,
        identifier: nostrURI.d,
      })
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

  private async nostrFetch(nostrUrl: string, options: Omit<Parameters<typeof git.fetch>[0], 'fs' | 'http' | 'corsProxy'> & { remote: string; dir: string }): Promise<{ fetchHead?: string; fetchHeadDescription?: string }> {
    // Parse the Nostr URI
    const nostrURI = await this.parseNostrCloneURI(nostrUrl);
    if (!nostrURI) {
      throw new Error('Invalid Nostr URI format');
    }

    console.log(`Fetching updates from Nostr repository: ${nostrUrl}`);

    // Fetch the latest repository state from Nostr
    const { repo, state } = await this.fetchNostrRepo(nostrURI);

    if (!repo) {
      throw new Error('Repository not found on Nostr network');
    }

    // If we have a state event, update our refs to match
    if (state) {
      const stateInfo = this.extractRepositoryState(state);
      console.log(`Updating repository state from Nostr: HEAD=${stateInfo.HEAD}, refs=${Object.keys(stateInfo.refs).length}`);

      // Update local refs to match the Nostr state
      const updatedRefs: string[] = [];
      for (const [refName, commitId] of Object.entries(stateInfo.refs)) {
        try {
          // Check if we have this commit locally
          try {
            await git.readCommit({
              fs: this.fs,
              dir: options.dir,
              oid: commitId,
            });

            // We have the commit, update the ref
            await git.writeRef({
              fs: this.fs,
              dir: options.dir,
              ref: refName,
              value: commitId,
            });

            updatedRefs.push(refName);
            console.log(`✓ Updated ${refName} to ${commitId}`);
          } catch {
            // We don't have this commit, need to fetch from the actual Git remote
            console.log(`⚠ Commit ${commitId} for ${refName} not found locally, need to fetch from Git remote`);
          }
        } catch (error) {
          console.warn(`Failed to update ref ${refName}:`, error);
        }
      }

      // If we updated refs but some commits are missing, try to fetch from Git remotes
      if (updatedRefs.length < Object.keys(stateInfo.refs).length) {
        await this.fetchMissingCommitsFromGitRemotes(repo, options.dir, stateInfo.refs);
      }

      // Update HEAD if specified
      if (stateInfo.HEAD) {
        try {
          await git.writeRef({
            fs: this.fs,
            dir: options.dir,
            ref: 'HEAD',
            value: stateInfo.HEAD,
            symbolic: true,
          });
          console.log(`✓ Updated HEAD to ${stateInfo.HEAD}`);
        } catch (error) {
          console.warn(`Failed to update HEAD:`, error);
        }
      }

      return {
        fetchHead: stateInfo.headCommit,
        fetchHeadDescription: `Fetched from Nostr repository state (${updatedRefs.length} refs updated)`,
      };
    } else {
      console.log('No repository state found on Nostr, checking for updates from Git remotes');

      // No state event, try to fetch from the Git clone URLs
      return this.fetchFromGitRemotes(repo, options.dir);
    }
  }

  private async nostrPull(nostrUrl: string, options: Omit<Parameters<typeof git.pull>[0], 'fs' | 'http' | 'corsProxy'> & { remote: string; dir: string }): Promise<void> {
    // First, fetch the latest state
    const fetchResult = await this.nostrFetch(nostrUrl, options);

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
      });

      if (mergeResult.alreadyMerged) {
        console.log('Already up to date');
      } else {
        console.log(`Merged ${upstreamCommit} into ${currentBranch}`);
      }
    }
  }

  private async nostrPush(nostrUrl: string, options: Omit<Parameters<typeof git.push>[0], 'fs' | 'http' | 'corsProxy'> & { signer: NostrSigner }) {
    const { signer, ...gitPushOptions } = options;
    const dir = options.dir || '.';
    const ref = options.ref || 'HEAD';
    const remoteRef = options.remoteRef || ref;
    const force = options.force || false;

    // Parse the Nostr URI
    const nostrURI = await this.parseNostrCloneURI(nostrUrl);
    if (!nostrURI) {
      throw new Error('Invalid Nostr URI format');
    }

    console.log(`Pushing to Nostr repository: ${nostrUrl}`);

    // Fetch the repository announcement and state to get relay information and current remote state
    const { repo, state } = await this.fetchNostrRepo(nostrURI);
    if (!repo) {
      throw new Error('Repository announcement not found on Nostr network');
    }

    // If we have a state event and --force was not used, check if fast-forward is possible.
    // we cant let the server do this as we publish the state update first
    if (state && !force) {
      const stateInfo = this.extractRepositoryState(state);
      const remoteRefName = remoteRef.startsWith('refs/') ? remoteRef : `refs/heads/${remoteRef}`;
      const remoteCommit = stateInfo.refs[remoteRefName];

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
    const relayUrls: string[] = [];

    for (const [name, ...values] of repo.tags) {
      if (name === 'relays' && values.length > 0) {
        for (const value of values) {
          try {
            const url = new URL(value);
            if (url.protocol === 'wss:') {
              relayUrls.push(url.href);
            }
          } catch {
            // Ignore invalid URLs
          }
        }
      }
    }

    // Get clone URLs using shared function (only https for push)
    const allCloneUrls = getCloneURLs(repo);
    const cloneUrls = allCloneUrls.filter(url => url.startsWith('https:'));

    // If no relays specified in announcement, use default git-focused relays
    if (relayUrls.length === 0) {
      relayUrls.push(
        'wss://git.shakespeare.diy/',
        'wss://relay.ngit.dev/',
        'wss://relay.nostr.band/'
      );
    }

    // Get current repository state
    const repoState = await this.getCurrentRepositoryState(dir);

    // Create repository state event (kind 30618)
    const stateEvent = await signer.signEvent({
      kind: 30618,
      created_at: Math.floor(Date.now() / 1000),
      content: '',
      tags: [
        ['d', nostrURI.d], // Repository identifier
        ...repoState.refTags,
        ...(repoState.headRef ? [['HEAD', repoState.headRef]] : []),
      ],
    });

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
    if (cloneUrls.length === 0) {
      console.warn('No Git clone URLs found in repository announcement');
      return;
    }

    // Wait 5 seconds for GRASP servers to update
    await new Promise(resolve => setTimeout(resolve, 5000));

    let pushSuccessful = false;
    let lastError: Error | null = null;

    for (const cloneUrl of cloneUrls) {
      console.log(`Pushing to Git remote: ${cloneUrl}`);

      try {
        // Push to the temporary remote
        await git.push({
          fs: this.fs,
          http: this.http,
          dir,
          url: cloneUrl,
          ...gitPushOptions,
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

  private async fetchMissingCommitsFromGitRemotes(repo: NostrEvent, dir: string, refs: Record<string, string>): Promise<void> {
    // Get clone URLs from the repository announcement
    const cloneUrls = getCloneURLs(repo);

    if (cloneUrls.length === 0) {
      console.warn('No Git clone URLs available to fetch missing commits');
      return;
    }

    // Try to fetch missing commits from each Git remote
    for (const cloneUrl of cloneUrls) {
      console.log(`Fetching missing commits from: ${cloneUrl}`);

      try {
        // Fetch from the clone URL
        await git.fetch({
          fs: this.fs,
          http: this.http,
          dir,
          url: cloneUrl,
        });

        // Update our refs to match the Nostr state
        for (const [refName, commitId] of Object.entries(refs)) {
          try {
            // Check if we now have this commit
            await git.readCommit({
              fs: this.fs,
              dir,
              oid: commitId,
            });

            // Update the ref
            await git.writeRef({
              fs: this.fs,
              dir,
              ref: refName,
              value: commitId,
            });

            console.log(`✓ Updated ${refName} to ${commitId} after fetching`);
          } catch {
            // Still don't have this commit
            console.warn(`Still missing commit ${commitId} for ${refName}`);
          }
        }

        // Successfully fetched from this remote
        return;
      } catch (fetchError) {
        console.warn(`Failed to fetch from ${cloneUrl}:`, fetchError);
      }
    }
  }

  private async fetchFromGitRemotes(repo: NostrEvent, dir: string): Promise<{ fetchHead?: string; fetchHeadDescription?: string }> {
    // Get clone URLs from the repository announcement
    const cloneUrls = getCloneURLs(repo);

    if (cloneUrls.length === 0) {
      throw new Error('No Git clone URLs available for fetching');
    }

    // Try to fetch from each Git remote
    let lastError: Error | null = null;
    for (const cloneUrl of cloneUrls) {
      try {
        console.log(`Fetching from Git remote: ${cloneUrl}`);

        // Add a temporary remote
        const tempRemoteName = `temp-${Date.now()}`;
        await git.addRemote({
          fs: this.fs,
          dir,
          remote: tempRemoteName,
          url: cloneUrl,
        });

        try {
          // Fetch from the temporary remote
          const fetchResult = await git.fetch({
            fs: this.fs,
            http: this.http,
            dir,
            remote: tempRemoteName,
          });

          // Remove the temporary remote
          await git.deleteRemote({
            fs: this.fs,
            dir,
            remote: tempRemoteName,
          });

          return {
            fetchHead: fetchResult.fetchHead || undefined,
            fetchHeadDescription: `Fetched from Git remote: ${cloneUrl}`,
          };
        } catch (fetchError) {
          // Clean up the temporary remote
          try {
            await git.deleteRemote({
              fs: this.fs,
              dir,
              remote: tempRemoteName,
            });
          } catch {
            // Ignore cleanup errors
          }
          throw fetchError;
        }
      } catch (error) {
        console.warn(`Failed to fetch from ${cloneUrl}:`, error);
        lastError = error instanceof Error ? error : new Error('Unknown error');
      }
    }

    throw lastError || new Error('All fetch attempts failed');
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

/**
 * Extract clone URLs from a Nostr repository event (kind 30617).
 * Collects all values from 'clone' tags and validates they are http/https URLs.
 */
function getCloneURLs(event: NostrEvent): string[] {
  const urls = new Set<string>();

  for (const [name, ...values] of event.tags) {
    if (name === 'clone') {
      for (const value of values) {
        if (value) {
          try {
            const url = new URL(value);
            if (url.protocol === 'http:' || url.protocol === 'https:') {
              urls.add(url.href);
            }
          } catch {
            // Ignore invalid URLs
          }
        }
      }
    }
  }

  return [...urls];
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
