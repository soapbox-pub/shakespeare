import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { NIP05 } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';
import type { NPool } from '@nostrify/nostrify';
import type { JSRuntimeFS } from './JSRuntime';

export interface GitOptions {
  fs: JSRuntimeFS;
  nostr: NPool;
  corsProxy?: string;
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
  private nostr: NPool;
  private corsProxy?: string;

  constructor(options: GitOptions) {
    this.fs = options.fs;
    this.nostr = options.nostr;
    this.corsProxy = options.corsProxy;
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
      const nostrUri = await this.parseNostrCloneURI(options.url);
      if (!nostrUri) {
        throw new Error('Invalid Nostr clone URI format');
      }

      // Fetch clone URLs from Nostr
      const cloneUrls = await this.fetchNostrRepository(nostrUri);

      // Try cloning from each URL in order
      return this.tryCloneUrls(cloneUrls, options);
    }

    // Regular Git URL
    return git.clone({
      fs: this.fs,
      http,
      corsProxy: this.corsProxy,
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
    return git.commit({
      fs: this.fs,
      ...options,
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
    return git.getRemoteInfo({
      http,
      corsProxy: this.corsProxy,
      ...options,
    });
  }

  async fetch(options: Omit<Parameters<typeof git.fetch>[0], 'fs' | 'http' | 'corsProxy'>) {
    return git.fetch({
      fs: this.fs,
      http,
      corsProxy: this.corsProxy,
      ...options,
    });
  }

  async pull(options: Omit<Parameters<typeof git.pull>[0], 'fs' | 'http' | 'corsProxy'>) {
    return git.pull({
      fs: this.fs,
      http,
      corsProxy: this.corsProxy,
      ...options,
    });
  }

  async push(options: Omit<Parameters<typeof git.push>[0], 'fs' | 'http' | 'corsProxy'>) {
    return git.push({
      fs: this.fs,
      http,
      corsProxy: this.corsProxy,
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
      http,
      corsProxy: this.corsProxy,
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
      http,
      corsProxy: this.corsProxy,
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
          relay: parts[1],
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

  private async fetchNostrRepository(nostrURI: NostrCloneURI): Promise<string[]> {
    const signal = AbortSignal.timeout(10000); // 10 second timeout

    // Build the filter for the NIP-34 repository announcement
    const filter = {
      kinds: [30617],
      authors: [nostrURI.pubkey],
      '#d': [nostrURI.d],
      limit: 1,
    };

    // Use a specific relay if provided
    const client = nostrURI.relay
      ? this.nostr.relay(nostrURI.relay)
      : this.nostr.group(['wss://relay.ngit.dev/', 'wss://gitnostr.com/']);

    // Query for the repository announcement event
    const events = await client.query([filter], { signal });

    if (events.length === 0) {
      throw new Error('Repository not found on Nostr network');
    }

    const repoEvent = events[0];

    // Extract clone URLs from the event tags
    const cloneUrls: string[] = [];
    for (const tag of repoEvent.tags) {
      if (tag[0] === 'clone' && tag[1]) {
        cloneUrls.push(tag[1]);
      }
    }

    if (cloneUrls.length === 0) {
      throw new Error('No clone URLs found in repository announcement');
    }

    return cloneUrls;
  }

  private async tryCloneUrls(cloneUrls: string[], originalOptions: Omit<Parameters<typeof git.clone>[0], 'fs' | 'http' | 'corsProxy'>): Promise<void> {
    let lastError: Error | null = null;

    for (const cloneUrl of cloneUrls) {
      try {
        console.log(`Attempting to clone from: ${cloneUrl}`);

        // Try cloning with a timeout
        await Promise.race([
          git.clone({
            fs: this.fs,
            http,
            corsProxy: this.corsProxy,
            ...originalOptions,
            url: cloneUrl, // Override the URL with the actual Git URL
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Clone timeout')), 30000)
          )
        ]);

        // After successful clone, update the origin remote to point to the Nostr URI
        await this.setRemoteURL({
          dir: originalOptions.dir,
          remote: 'origin',
          url: originalOptions.url,
        });

        return; // Success!
      } catch (error) {
        console.warn(`Failed to clone from ${cloneUrl}:`, error);
        lastError = error instanceof Error ? error : new Error('Unknown error');
        continue; // Try the next URL
      }
    }

    // If we get here, all clone attempts failed
    throw lastError || new Error('All clone attempts failed');
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
}