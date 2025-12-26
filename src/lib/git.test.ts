import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Git } from './git';
import type { JSRuntimeFS, DirectoryEntry } from './JSRuntime';
import type { NPool, NostrEvent } from '@nostrify/nostrify';
import { NSecSigner } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

/**
 * Minimal mock filesystem implementation for testing
 * Implements only the essential methods needed by isomorphic-git
 */
class MockFS implements JSRuntimeFS {
  private files: Map<string, string | Uint8Array> = new Map();
  private dirs: Set<string> = new Set(['/']);

  // Expose promises property for isomorphic-git compatibility
  promises = this;

  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, options: 'utf8'): Promise<string>;
  async readFile(path: string, options: string): Promise<string>;
  async readFile(path: string, options: { encoding: 'utf8' }): Promise<string>;
  async readFile(path: string, options: { encoding: string }): Promise<string>;
  async readFile(path: string, options?: string | { encoding?: string }): Promise<string | Uint8Array>;
  async readFile(path: string, options?: string | { encoding?: string }): Promise<string | Uint8Array> {
    const content = this.files.get(path);
    if (content === undefined) {
      const error = new Error(`ENOENT: no such file or directory, open '${path}'`) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
    const encoding = typeof options === 'string' ? options : options?.encoding;
    if (encoding === 'utf8') {
      if (typeof content === 'string') return content;
      return new TextDecoder('utf-8').decode(content as Uint8Array);
    }
    if (typeof content === 'string') return new TextEncoder().encode(content);
    return content as Uint8Array;
  }

  async writeFile(path: string, data: string | Uint8Array): Promise<void> {
    this.files.set(path, data);
    const dir = path.split('/').slice(0, -1).join('/') || '/';
    this.dirs.add(dir);
  }

  readdir(path: string): Promise<string[]>;
  readdir(path: string, options: { withFileTypes: true }): Promise<DirectoryEntry[]>;
  readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]> {
    if (!this.dirs.has(path)) {
      const error = new Error(`ENOENT: no such file or directory, scandir '${path}'`) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }

    const entries: string[] = [];
    for (const dir of this.dirs) {
      if (dir.startsWith(path + '/') && !dir.slice(path.length + 1).includes('/')) {
        entries.push(dir.slice(path.length + 1));
      }
    }
    for (const file of this.files.keys()) {
      if (file.startsWith(path + '/') && !file.slice(path.length + 1).includes('/')) {
        entries.push(file.slice(path.length + 1));
      }
    }

    const uniqueEntries = [...new Set(entries)];
    if (options?.withFileTypes) {
      return uniqueEntries.map(name => {
        const fullPath = path.endsWith('/') ? path + name : path + '/' + name;
        const isDir = this.dirs.has(fullPath);
        return {
          name,
          isDirectory: () => isDir,
          isFile: () => !isDir,
          isSymbolicLink: () => false,
        } as unknown as DirectoryEntry;
      });
    }
    return uniqueEntries;
  }

  async mkdir(path: string): Promise<void> {
    this.dirs.add(path);
  }

  async stat(path: string): Promise<{
    isDirectory(): boolean;
    isFile(): boolean;
    isSymbolicLink(): boolean;
    mtimeMs?: number;
    mtime?: Date;
    ctimeMs?: number;
    ctime?: Date;
    mode?: number;
    size?: number;
    ino?: number;
    uid?: number;
    gid?: number;
  }> {
    const now = new Date();
    const nowMs = now.getTime();
    if (this.dirs.has(path)) {
      return {
        isDirectory: () => true,
        isFile: () => false,
        isSymbolicLink: () => false,
        mtimeMs: nowMs,
        mtime: now,
        ctimeMs: nowMs,
        ctime: now,
        mode: 0o40755,
        size: 0,
        ino: 1,
        uid: 1000,
        gid: 1000,
      };
    }
    if (this.files.has(path)) {
      const content = this.files.get(path)!;
      const size = typeof content === 'string' ? content.length : content.byteLength;
      return {
        isDirectory: () => false,
        isFile: () => true,
        isSymbolicLink: () => false,
        mtimeMs: nowMs,
        mtime: now,
        ctimeMs: nowMs,
        ctime: now,
        mode: 0o100644,
        size,
        ino: 1,
        uid: 1000,
        gid: 1000,
      };
    }
    const error = new Error(`ENOENT: no such file or directory, stat '${path}'`) as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    throw error;
  }

  async lstat(path: string): Promise<{
    isDirectory(): boolean;
    isFile(): boolean;
    isSymbolicLink(): boolean;
    mtimeMs?: number;
    mtime?: Date;
    ctimeMs?: number;
    ctime?: Date;
    mode?: number;
    size?: number;
    ino?: number;
    uid?: number;
    gid?: number;
  }> {
    return this.stat(path);
  }

  async readlink(_path: string): Promise<string> {
    const error = new Error('EINVAL: invalid argument') as NodeJS.ErrnoException;
    error.code = 'EINVAL';
    throw error;
  }

  async symlink(_target: string, _path: string): Promise<void> {
    // No-op for mock
  }

  async unlink(path: string): Promise<void> {
    this.files.delete(path);
  }

  async rmdir(path: string): Promise<void> {
    this.dirs.delete(path);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    if (this.files.has(oldPath)) {
      const content = this.files.get(oldPath);
      this.files.delete(oldPath);
      this.files.set(newPath, content!);
    }
    if (this.dirs.has(oldPath)) {
      this.dirs.delete(oldPath);
      this.dirs.add(newPath);
    }
  }

  async chmod(_path: string, _mode: number): Promise<void> {
    // No-op for mock
  }

  async rm(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (options?.recursive) {
      for (const file of [...this.files.keys()]) {
        if (file.startsWith(path + '/') || file === path) this.files.delete(file);
      }
      for (const dir of [...this.dirs]) {
        if (dir.startsWith(path + '/') || dir === path) this.dirs.delete(dir);
      }
    } else {
      await this.unlink(path);
    }
  }
}

/**
 * Mock Nostr pool
 */
const createMockNostr = (): NPool => {
  const events: NostrEvent[] = [];
  return {
    req: vi.fn(),
    query: vi.fn(async () => events),
    event: vi.fn(async (event: NostrEvent) => { events.push(event); }),
    group: vi.fn().mockReturnValue({ query: vi.fn(async () => events) }),
    relay: vi.fn(),
    relays: new Map(),
    close: vi.fn(),
  } as unknown as NPool;
};

/**
 * Create a test Nostr signer using NSecSigner
 */
const createTestSigner = () => {
  // Generate a random test nsec (32 bytes of zeros as Uint8Array)
  const testSecretKey = new Uint8Array(32).fill(1);
  return new NSecSigner(testSecretKey);
};

describe('Git', () => {
  let fs: JSRuntimeFS;
  let nostr: NPool;
  let git: Git;

  beforeEach(() => {
    fs = new MockFS();
    nostr = createMockNostr();
    git = new Git({
      fs,
      nostr,
      systemAuthor: { name: 'Test User', email: 'test@example.com' },
    });
  });

  describe('Basic Git Operations', () => {
    describe('init', () => {
      it('should initialize a new repository', async () => {
        await git.init({ dir: '/repo', defaultBranch: 'main' });
        const gitDirStat = await fs.stat('/repo/.git');
        expect(gitDirStat.isDirectory()).toBe(true);
      });
    });

    describe('add and commit', () => {
      it('should add and commit files', async () => {
        await git.init({ dir: '/repo', defaultBranch: 'main' });
        await fs.mkdir('/repo/.shakespeare');
        await fs.writeFile('/repo/.shakespeare/git.json', JSON.stringify({ name: 'Test', email: 'test@test.com' }));
        await fs.writeFile('/repo/test.txt', 'Hello World');
        await git.add({ dir: '/repo', filepath: 'test.txt' });
        const sha = await git.commit({ dir: '/repo', message: 'Initial commit' });
        expect(sha).toBeDefined();
        expect(typeof sha).toBe('string');
        expect(sha.length).toBe(40);
      });

      it('should add co-author when enabled', async () => {
        await git.init({ dir: '/repo', defaultBranch: 'main' });
        await fs.mkdir('/repo/.shakespeare');
        await fs.writeFile('/repo/.shakespeare/git.json', JSON.stringify({ name: 'Test', email: 'test@test.com', coAuthorEnabled: true }));
        await fs.writeFile('/repo/test.txt', 'Hello');
        await git.add({ dir: '/repo', filepath: 'test.txt' });
        const sha = await git.commit({ dir: '/repo', message: 'Test' });
        const commit = await git.readCommit({ dir: '/repo', oid: sha });
        expect(commit.commit.message).toContain('Co-authored-by: Test User <test@example.com>');
      });
    });

    describe('status', () => {
      it('should get file status', async () => {
        await git.init({ dir: '/repo', defaultBranch: 'main' });
        await fs.writeFile('/repo/test.txt', 'Hello');
        const status = await git.status({ dir: '/repo', filepath: 'test.txt' });
        expect(status).toBeDefined();
      });
    });

    describe('log', () => {
      it('should get commit history', async () => {
        await git.init({ dir: '/repo', defaultBranch: 'main' });
        await fs.mkdir('/repo/.shakespeare');
        await fs.writeFile('/repo/.shakespeare/git.json', JSON.stringify({ name: 'Test', email: 'test@test.com' }));
        await fs.writeFile('/repo/test.txt', 'Hello');
        await git.add({ dir: '/repo', filepath: 'test.txt' });
        await git.commit({ dir: '/repo', message: 'First' });
        const commits = await git.log({ dir: '/repo' });
        expect(commits.length).toBeGreaterThan(0);
        expect(commits[0].commit.message).toContain('First');
      });
    });

    describe('branch operations', () => {
      it('should create and list branches', async () => {
        await git.init({ dir: '/repo', defaultBranch: 'main' });
        await fs.mkdir('/repo/.shakespeare');
        await fs.writeFile('/repo/.shakespeare/git.json', JSON.stringify({ name: 'Test', email: 'test@test.com' }));
        await fs.writeFile('/repo/test.txt', 'Hello');
        await git.add({ dir: '/repo', filepath: 'test.txt' });
        await git.commit({ dir: '/repo', message: 'Initial' });
        await git.branch({ dir: '/repo', ref: 'feature' });
        const branches = await git.listBranches({ dir: '/repo' });
        expect(branches).toContain('main');
        expect(branches).toContain('feature');
      });

      it('should checkout branches', async () => {
        await git.init({ dir: '/repo', defaultBranch: 'main' });
        await fs.mkdir('/repo/.shakespeare');
        await fs.writeFile('/repo/.shakespeare/git.json', JSON.stringify({ name: 'Test', email: 'test@test.com' }));
        await fs.writeFile('/repo/test.txt', 'Hello');
        await git.add({ dir: '/repo', filepath: 'test.txt' });
        await git.commit({ dir: '/repo', message: 'Initial' });
        await git.branch({ dir: '/repo', ref: 'feature' });
        await git.checkout({ dir: '/repo', ref: 'feature' });
        const currentBranch = await git.currentBranch({ dir: '/repo' });
        expect(currentBranch).toBe('feature');
      });
    });

    describe('remote operations', () => {
      it('should add and list remotes', async () => {
        await git.init({ dir: '/repo', defaultBranch: 'main' });
        await git.addRemote({ dir: '/repo', remote: 'origin', url: 'https://github.com/user/repo.git' });
        const remotes = await git.listRemotes({ dir: '/repo' });
        expect(remotes).toHaveLength(1);
        expect(remotes[0].remote).toBe('origin');
        expect(remotes[0].url).toBe('https://github.com/user/repo.git');
      });

      it('should delete remotes', async () => {
        await git.init({ dir: '/repo', defaultBranch: 'main' });
        await git.addRemote({ dir: '/repo', remote: 'origin', url: 'https://github.com/user/repo.git' });
        await git.deleteRemote({ dir: '/repo', remote: 'origin' });
        const remotes = await git.listRemotes({ dir: '/repo' });
        expect(remotes).toHaveLength(0);
      });

      it('should get and set remote URL', async () => {
        await git.init({ dir: '/repo', defaultBranch: 'main' });
        await git.addRemote({ dir: '/repo', remote: 'origin', url: 'https://github.com/user/repo.git' });
        const url = await git.getRemoteURL('/repo', 'origin');
        expect(url).toBe('https://github.com/user/repo.git');
        await git.setRemoteURL({ dir: '/repo', remote: 'origin', url: 'https://github.com/user/new.git' });
        const newUrl = await git.getRemoteURL('/repo', 'origin');
        expect(newUrl).toBe('https://github.com/user/new.git');
      });
    });

    describe('tag operations', () => {
      it('should create and list tags', async () => {
        await git.init({ dir: '/repo', defaultBranch: 'main' });
        await fs.mkdir('/repo/.shakespeare');
        await fs.writeFile('/repo/.shakespeare/git.json', JSON.stringify({ name: 'Test', email: 'test@test.com' }));
        await fs.writeFile('/repo/test.txt', 'Hello');
        await git.add({ dir: '/repo', filepath: 'test.txt' });
        await git.commit({ dir: '/repo', message: 'Initial' });
        await git.tag({ dir: '/repo', ref: 'v1.0.0' });
        const tags = await git.listTags({ dir: '/repo' });
        expect(tags).toContain('v1.0.0');
      });

      it('should delete tags', async () => {
        await git.init({ dir: '/repo', defaultBranch: 'main' });
        await fs.mkdir('/repo/.shakespeare');
        await fs.writeFile('/repo/.shakespeare/git.json', JSON.stringify({ name: 'Test', email: 'test@test.com' }));
        await fs.writeFile('/repo/test.txt', 'Hello');
        await git.add({ dir: '/repo', filepath: 'test.txt' });
        await git.commit({ dir: '/repo', message: 'Initial' });
        await git.tag({ dir: '/repo', ref: 'v1.0.0' });
        await git.deleteTag({ dir: '/repo', ref: 'v1.0.0' });
        const tags = await git.listTags({ dir: '/repo' });
        expect(tags).not.toContain('v1.0.0');
      });
    });
  });

  describe('Nostr Git Operations', () => {
    const testPubkey = 'a'.repeat(64);
    const testNpub = nip19.npubEncode(testPubkey);
    let signer: NSecSigner;

    beforeEach(() => {
      signer = createTestSigner();
      git = new Git({
        fs,
        nostr,
        signer,
        systemAuthor: { name: 'Test User', email: 'test@example.com' },
        relayList: [{ url: new URL('wss://relay.example.com'), read: true, write: true }],
      });
    });

    describe('nostr clone', () => {
      it('should handle missing Nostr repository', async () => {
        vi.mocked(nostr.group).mockReturnValue({
          query: vi.fn(async () => []),
        } as unknown as ReturnType<NPool['group']>);

        await expect(git.clone({
          url: `nostr://${testNpub}/nonexistent`,
          dir: '/nostr-repo',
        })).rejects.toThrow('Repository not found on Nostr network');
      });

      it('should handle missing clone URLs', async () => {
        const repoEvent: NostrEvent = {
          id: 'repo-event-id',
          pubkey: testPubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 30617,
          tags: [['d', 'test-repo']],
          content: '',
          sig: 'test-sig',
        };

        const stateEvent: NostrEvent = {
          id: 'state-event-id',
          pubkey: testPubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 30618,
          tags: [['d', 'test-repo'], ['HEAD', 'ref: refs/heads/main']],
          content: '',
          sig: 'test-sig',
        };

        vi.mocked(nostr.group).mockReturnValue({
          query: vi.fn(async () => [repoEvent, stateEvent]),
        } as unknown as ReturnType<NPool['group']>);

        await expect(git.clone({
          url: `nostr://${testNpub}/test-repo`,
          dir: '/nostr-repo',
        })).rejects.toThrow('No clone URLs found in repository announcement');
      });
    });

    describe('nostr push', () => {
      it('should require signer for Nostr push', async () => {
        const gitWithoutSigner = new Git({
          fs,
          nostr,
          systemAuthor: { name: 'Test User', email: 'test@example.com' },
        });

        const repoEvent: NostrEvent = {
          id: 'repo-event-id',
          pubkey: testPubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 30617,
          tags: [['d', 'test-repo'], ['clone', 'https://git.example.com/user/repo.git']],
          content: '',
          sig: 'test-sig',
        };

        vi.mocked(nostr.group).mockReturnValue({
          query: vi.fn(async () => [repoEvent]),
        } as unknown as ReturnType<NPool['group']>);

        // Can't test actual push without complex setup, but we can verify signer requirement
        await expect(async () => {
          await git.init({ dir: '/nostr-repo', defaultBranch: 'main' });
          await git.addRemote({ dir: '/nostr-repo', remote: 'origin', url: `nostr://${testNpub}/test-repo` });
          await gitWithoutSigner.push({ dir: '/nostr-repo', remote: 'origin', ref: 'main' });
        }).rejects.toThrow('Signer required for Nostr push');
      });
    });
  });
});
