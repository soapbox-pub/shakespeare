import git, { FetchResult, GitHttpRequest, GitHttpResponse, HttpClient } from 'isomorphic-git';
import { proxyUrl } from './proxyUrl';
import { readGitSettings } from './configUtils';
import { parseRepositoryAnnouncement, type RepositoryAnnouncement } from './announceRepository';
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
    // TODO: implement Nostr remote info retrieval
  }


  private async nostrClone(nostrURI: NostrURI, options: Omit<Parameters<typeof git.clone>[0], 'fs' | 'http' | 'corsProxy'>): Promise<void> {
    // TODO: implement Nostr clone
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


  private async nostrFetch(nostrURI: NostrURI, options: Omit<Parameters<typeof git.fetch>[0], 'fs' | 'http' | 'corsProxy'> & { remote: string; dir: string }): Promise<FetchResult> {
    // TODO: implement Nostr fetch
  }

  private async nostrPull(nostrURI: NostrURI, options: Omit<Parameters<typeof git.pull>[0], 'fs' | 'http' | 'corsProxy'> & { remote: string; dir: string }): Promise<void> {
    // TODO: implement Nostr pull
  }

  private async nostrPush(nostrURI: NostrURI, options: Omit<Parameters<typeof git.push>[0], 'fs' | 'http' | 'onAuth' | 'corsProxy'>) {
    // TODO: implement Nostr push
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