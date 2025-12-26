import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Git } from './git';
import type { JSRuntimeFS } from './JSRuntime';
import type { NPool, NostrEvent } from '@nostrify/nostrify';
import type { NostrSigner } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';
import { MockFS } from '@/test/MockFS';
import { MockGitHttpServer, createMockRepository } from '@/test/MockGitHttpServer';

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
 * Create a mock Nostr signer for testing
 */
const createTestSigner = () => {
  const testPubkey = '0'.repeat(64);
  return {
    getPublicKey: vi.fn(async () => testPubkey),
    signEvent: vi.fn(async (event: Omit<NostrEvent, 'id' | 'pubkey' | 'sig'>) => ({
      ...event,
      id: 'test-event-id-' + Math.random().toString(36).slice(2),
      pubkey: testPubkey,
      sig: 'test-sig-' + Math.random().toString(36).slice(2),
    })),
    nip04: {
      encrypt: vi.fn(async () => 'encrypted'),
      decrypt: vi.fn(async () => 'decrypted'),
    },
    nip44: {
      encrypt: vi.fn(async () => 'encrypted'),
      decrypt: vi.fn(async () => 'decrypted'),
    },
  };
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

    describe('clone operations', () => {
      it('should clone from mock HTTP server', async () => {
        // Create a mock Git HTTP server
        const mockServer = new MockGitHttpServer();
        const mockRepo = createMockRepository();
        mockServer.addRepository('https://example.com/test/repo', mockRepo);

        // Create a Git instance with the mock fetch function
        const gitWithMock = new Git({
          fs,
          nostr,
          systemAuthor: { name: 'Test User', email: 'test@example.com' },
          fetch: mockServer.fetch,
        });

        // Clone the repository
        await gitWithMock.clone({
          url: 'https://example.com/test/repo.git',
          dir: '/cloned-repo',
          singleBranch: true,
          depth: 1,
        });

        // Verify the repository was cloned
        const gitDirStat = await fs.stat('/cloned-repo/.git');
        expect(gitDirStat.isDirectory()).toBe(true);

        // Verify we can read the current branch
        const currentBranch = await gitWithMock.currentBranch({ dir: '/cloned-repo' });
        expect(currentBranch).toBe('main');

        // Read and verify README content
        const readmeContent = await fs.readFile('/cloned-repo/README.md', 'utf8');
        expect(readmeContent).toContain('Test Repository');
      });

      it('should handle 404 for non-existent repository', async () => {
        const mockServer = new MockGitHttpServer();

        const gitWithMock = new Git({
          fs,
          nostr,
          systemAuthor: { name: 'Test User', email: 'test@example.com' },
          fetch: mockServer.fetch,
        });

        // Try to clone a non-existent repository
        await expect(gitWithMock.clone({
          url: 'https://example.com/nonexistent/repo.git',
          dir: '/cloned-repo',
        })).rejects.toThrow();
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
    let signer: NostrSigner;

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

      it('should clone from Nostr with mock git server', async () => {
        // Create a mock Git HTTP server
        const mockServer = new MockGitHttpServer();
        const mockRepo = createMockRepository();
        mockServer.addRepository('https://git.example.com/user/repo', mockRepo);

        // Create Nostr repository announcement (kind 30617) with clone URL
        const repoEvent: NostrEvent = {
          id: 'repo-event-id',
          pubkey: testPubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 30617,
          tags: [
            ['d', 'my-repo'],
            ['clone', 'https://git.example.com/user/repo.git'],
          ],
          content: '',
          sig: 'test-sig',
        };

        // Create Nostr repository state (kind 30618) with refs
        // Use the actual commit SHA from the mock repository
        const stateEvent: NostrEvent = {
          id: 'state-event-id',
          pubkey: testPubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 30618,
          tags: [
            ['d', 'my-repo'],
            ['HEAD', 'ref: refs/heads/main'],
            ['refs/heads/main', '2e538da98e06b91e70268817b0fa3f01aeeb003e'],
          ],
          content: '',
          sig: 'test-sig',
        };

        // Mock Nostr query to return the repo and state events
        vi.mocked(nostr.group).mockReturnValue({
          query: vi.fn(async () => [repoEvent, stateEvent]),
        } as unknown as ReturnType<NPool['group']>);

        // Create Git instance with the mock fetch function
        const gitWithMock = new Git({
          fs,
          nostr,
          signer,
          systemAuthor: { name: 'Test User', email: 'test@example.com' },
          relayList: [{ url: new URL('wss://relay.example.com'), read: true, write: true }],
          fetch: mockServer.fetch,
        });

        // Clone the Nostr repository
        await gitWithMock.clone({
          url: `nostr://${testNpub}/my-repo`,
          dir: '/nostr-repo',
          singleBranch: true,
          depth: 1,
        });

        // Verify the repository was cloned
        const gitDirStat = await fs.stat('/nostr-repo/.git');
        expect(gitDirStat.isDirectory()).toBe(true);

        // Verify we can read the current branch
        const currentBranch = await gitWithMock.currentBranch({ dir: '/nostr-repo' });
        expect(currentBranch).toBe('main');

        // Verify the Nostr query was called to fetch repo events
        expect(nostr.group).toHaveBeenCalled();

        // Verify that remote refs were set up based on the Nostr state
        const remoteRefs = await gitWithMock.listBranches({ dir: '/nostr-repo', remote: 'origin' });
        expect(remoteRefs).toContain('main');
      });

      it('should handle multiple clone URLs and try fallbacks', async () => {
        // Create a mock Git HTTP server with only the second URL working
        const mockServer = new MockGitHttpServer();
        const mockRepo = createMockRepository();
        mockServer.addRepository('https://git2.example.com/user/repo', mockRepo);

        // Create Nostr repository announcement with multiple clone URLs
        const repoEvent: NostrEvent = {
          id: 'repo-event-id',
          pubkey: testPubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 30617,
          tags: [
            ['d', 'fallback-repo'],
            ['clone', 'https://git1.example.com/user/repo.git', 'https://git2.example.com/user/repo.git'],
          ],
          content: '',
          sig: 'test-sig',
        };

        const stateEvent: NostrEvent = {
          id: 'state-event-id',
          pubkey: testPubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 30618,
          tags: [
            ['d', 'fallback-repo'],
            ['HEAD', 'ref: refs/heads/main'],
            ['refs/heads/main', '2e538da98e06b91e70268817b0fa3f01aeeb003e'],
          ],
          content: '',
          sig: 'test-sig',
        };

        vi.mocked(nostr.group).mockReturnValue({
          query: vi.fn(async () => [repoEvent, stateEvent]),
        } as unknown as ReturnType<NPool['group']>);

        const gitWithMock = new Git({
          fs,
          nostr,
          signer,
          systemAuthor: { name: 'Test User', email: 'test@example.com' },
          relayList: [{ url: new URL('wss://relay.example.com'), read: true, write: true }],
          fetch: mockServer.fetch,
        });

        // Clone should succeed using the second URL as fallback
        await gitWithMock.clone({
          url: `nostr://${testNpub}/fallback-repo`,
          dir: '/nostr-repo-fallback',
          singleBranch: true,
          depth: 1,
        });

        // Verify the repository was cloned
        const gitDirStat = await fs.stat('/nostr-repo-fallback/.git');
        expect(gitDirStat.isDirectory()).toBe(true);

        const currentBranch = await gitWithMock.currentBranch({ dir: '/nostr-repo-fallback' });
        expect(currentBranch).toBe('main');
      });
    });

    describe('nostr fetch', () => {
      it('should correctly set up remote tracking refs', async () => {
        // Create a mock Git HTTP server
        const mockServer = new MockGitHttpServer();
        const mockRepo = createMockRepository();
        mockServer.addRepository('https://git.example.com/user/repo', mockRepo);

        // Create Nostr repository events
        // Use the actual commit SHA from the mock repository
        const repoEvent: NostrEvent = {
          id: 'repo-event-id',
          pubkey: testPubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 30617,
          tags: [
            ['d', 'my-repo'],
            ['clone', 'https://git.example.com/user/repo.git'],
          ],
          content: '',
          sig: 'test-sig',
        };

        const stateEvent: NostrEvent = {
          id: 'state-event-id',
          pubkey: testPubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 30618,
          tags: [
            ['d', 'my-repo'],
            ['HEAD', 'ref: refs/heads/main'],
            ['refs/heads/main', '2e538da98e06b91e70268817b0fa3f01aeeb003e'],
          ],
          content: '',
          sig: 'test-sig',
        };

        vi.mocked(nostr.group).mockReturnValue({
          query: vi.fn(async () => [repoEvent, stateEvent]),
        } as unknown as ReturnType<NPool['group']>);

        const gitWithMock = new Git({
          fs,
          nostr,
          signer,
          systemAuthor: { name: 'Test User', email: 'test@example.com' },
          relayList: [{ url: new URL('wss://relay.example.com'), read: true, write: true }],
          fetch: mockServer.fetch,
        });

        // Clone the repository first
        await gitWithMock.clone({
          url: `nostr://${testNpub}/my-repo`,
          dir: '/fetch-test-repo',
          singleBranch: true,
          depth: 1,
        });

        // Verify remote tracking refs were set up correctly
        const remoteBranches = await gitWithMock.listBranches({ dir: '/fetch-test-repo', remote: 'origin' });
        expect(remoteBranches).toContain('main');

        // Verify the remote HEAD is a symbolic ref pointing to the correct branch
        const remoteHeadRef = await gitWithMock.resolveRef({
          dir: '/fetch-test-repo',
          ref: 'refs/remotes/origin/HEAD',
          depth: 2,
        });
        expect(remoteHeadRef).toBe('refs/remotes/origin/main');
      });
    });

    describe('nostr pull', () => {
      it('should pull from Nostr repository and merge remote tracking branch', async () => {
        // Create a mock Git HTTP server
        const mockServer = new MockGitHttpServer();
        const mockRepo = createMockRepository();
        mockServer.addRepository('https://git.example.com/user/repo', mockRepo);

        // Create Nostr repository events
        const repoEvent: NostrEvent = {
          id: 'repo-event-id',
          pubkey: testPubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 30617,
          tags: [
            ['d', 'my-repo'],
            ['clone', 'https://git.example.com/user/repo.git'],
          ],
          content: '',
          sig: 'test-sig',
        };

        const stateEvent: NostrEvent = {
          id: 'state-event-id',
          pubkey: testPubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 30618,
          tags: [
            ['d', 'my-repo'],
            ['HEAD', 'ref: refs/heads/main'],
            ['refs/heads/main', '2e538da98e06b91e70268817b0fa3f01aeeb003e'],
          ],
          content: '',
          sig: 'test-sig',
        };

        vi.mocked(nostr.group).mockReturnValue({
          query: vi.fn(async () => [repoEvent, stateEvent]),
        } as unknown as ReturnType<NPool['group']>);

        const gitWithMock = new Git({
          fs,
          nostr,
          signer,
          systemAuthor: { name: 'Test User', email: 'test@example.com' },
          relayList: [{ url: new URL('wss://relay.example.com'), read: true, write: true }],
          fetch: mockServer.fetch,
        });

        // Clone the repository first
        await gitWithMock.clone({
          url: `nostr://${testNpub}/my-repo`,
          dir: '/nostr-repo',
          singleBranch: true,
          depth: 1,
        });

        // Set up tracking branch configuration
        await gitWithMock.setConfig({
          dir: '/nostr-repo',
          path: 'branch.main.remote',
          value: 'origin',
        });
        await gitWithMock.setConfig({
          dir: '/nostr-repo',
          path: 'branch.main.merge',
          value: 'refs/heads/main',
        });

        // Verify README exists after clone
        const readmeAfterClone = await fs.stat('/nostr-repo/README.md').then(() => true).catch(() => false);
        expect(readmeAfterClone).toBe(true);

        // Make a local change
        await fs.mkdir('/nostr-repo/.shakespeare');
        await fs.writeFile('/nostr-repo/.shakespeare/git.json', JSON.stringify({ name: 'Test', email: 'test@test.com' }));
        await fs.writeFile('/nostr-repo/local.txt', 'local change');
        await gitWithMock.add({ dir: '/nostr-repo', filepath: 'local.txt' });
        await gitWithMock.commit({ dir: '/nostr-repo', message: 'Local commit' });

        // Verify README still exists after local commit
        const readmeAfterCommit = await fs.stat('/nostr-repo/README.md').then(() => true).catch(() => false);
        expect(readmeAfterCommit).toBe(true);

        // Pull should merge the remote tracking branch
        await gitWithMock.pull({
          dir: '/nostr-repo',
        });

        // Verify the repository state
        const currentBranch = await gitWithMock.currentBranch({ dir: '/nostr-repo' });
        expect(currentBranch).toBe('main');

        // Verify both files exist (from remote and local)
        const readmeExists = await fs.stat('/nostr-repo/README.md').then(() => true).catch(() => false);
        const localExists = await fs.stat('/nostr-repo/local.txt').then(() => true).catch(() => false);
        expect(readmeExists).toBe(true);
        expect(localExists).toBe(true);
      });
    });

    describe('getNostrRemoteInfo', () => {
      it('should correctly parse symbolic HEAD reference', async () => {
        const repoEvent: NostrEvent = {
          id: 'repo-event-id',
          pubkey: testPubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 30617,
          tags: [
            ['d', 'test-repo'],
            ['clone', 'https://git.example.com/user/repo.git'],
          ],
          content: '',
          sig: 'test-sig',
        };

        const stateEvent: NostrEvent = {
          id: 'state-event-id',
          pubkey: testPubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 30618,
          tags: [
            ['d', 'test-repo'],
            ['HEAD', 'ref: refs/heads/main'],
            ['refs/heads/main', 'abc123def456'],
          ],
          content: '',
          sig: 'test-sig',
        };

        vi.mocked(nostr.group).mockReturnValue({
          query: vi.fn(async () => [repoEvent, stateEvent]),
        } as unknown as ReturnType<NPool['group']>);

        const remoteInfo = await git.getRemoteInfo({
          url: `nostr://${testNpub}/test-repo`,
        });

        // refs['HEAD'] should contain the raw symbolic ref value from NIP-34
        expect(remoteInfo.refs?.HEAD).toBe('ref: refs/heads/main');
        // The separate HEAD field should contain the extracted target
        expect(remoteInfo.HEAD).toBe('refs/heads/main');
        expect(remoteInfo.refs?.['refs/heads/main']).toBe('abc123def456');
      });

      it('should correctly parse direct HEAD reference (detached HEAD)', async () => {
        const repoEvent: NostrEvent = {
          id: 'repo-event-id',
          pubkey: testPubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 30617,
          tags: [
            ['d', 'test-repo'],
            ['clone', 'https://git.example.com/user/repo.git'],
          ],
          content: '',
          sig: 'test-sig',
        };

        const stateEvent: NostrEvent = {
          id: 'state-event-id',
          pubkey: testPubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 30618,
          tags: [
            ['d', 'test-repo'],
            ['HEAD', 'abc123def456'],
            ['refs/heads/main', 'abc123def456'],
          ],
          content: '',
          sig: 'test-sig',
        };

        vi.mocked(nostr.group).mockReturnValue({
          query: vi.fn(async () => [repoEvent, stateEvent]),
        } as unknown as ReturnType<NPool['group']>);

        const remoteInfo = await git.getRemoteInfo({
          url: `nostr://${testNpub}/test-repo`,
        });

        // HEAD should be the commit SHA
        expect(remoteInfo.refs?.HEAD).toBe('abc123def456');
        expect(remoteInfo.refs?.['refs/heads/main']).toBe('abc123def456');
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

      it('should publish state event with tags on push', async () => {
        // Create a mock Git HTTP server
        const mockServer = new MockGitHttpServer();
        const mockRepo = createMockRepository();
        mockServer.addRepository('https://git.example.com/user/repo', mockRepo);

        // Create Nostr repository events
        const repoEvent: NostrEvent = {
          id: 'repo-event-id',
          pubkey: testPubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 30617,
          tags: [
            ['d', 'my-repo'],
            ['clone', 'https://git.example.com/user/repo.git'],
          ],
          content: '',
          sig: 'test-sig',
        };

        const stateEvent: NostrEvent = {
          id: 'state-event-id',
          pubkey: testPubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 30618,
          tags: [
            ['d', 'my-repo'],
            ['HEAD', 'ref: refs/heads/main'],
            ['refs/heads/main', '2e538da98e06b91e70268817b0fa3f01aeeb003e'],
          ],
          content: '',
          sig: 'test-sig',
        };

        vi.mocked(nostr.group).mockReturnValue({
          query: vi.fn(async () => [repoEvent, stateEvent]),
        } as unknown as ReturnType<NPool['group']>);

        const gitWithMock = new Git({
          fs,
          nostr,
          signer,
          systemAuthor: { name: 'Test User', email: 'test@example.com' },
          relayList: [{ url: new URL('wss://relay.example.com'), read: true, write: true }],
          fetch: mockServer.fetch,
        });

        // Clone the repository first
        await gitWithMock.clone({
          url: `nostr://${testNpub}/my-repo`,
          dir: '/tag-test-repo',
          singleBranch: true,
          depth: 1,
        });

        // Create a tag
        await fs.mkdir('/tag-test-repo/.shakespeare');
        await fs.writeFile('/tag-test-repo/.shakespeare/git.json', JSON.stringify({ name: 'Test', email: 'test@test.com' }));
        await gitWithMock.tag({ dir: '/tag-test-repo', ref: 'v1.0.0' });

        // Clear the mock to track new calls
        vi.mocked(nostr.event).mockClear();

        // Push to Nostr
        try {
          await gitWithMock.push({ dir: '/tag-test-repo', remote: 'origin' });
        } catch {
          // Expected to fail because mock server doesn't support push
        }

        // Find the state event (kind 30618)
        const eventCalls = vi.mocked(nostr.event).mock.calls;
        const publishedStateEvent = eventCalls.find(([event]) => event.kind === 30618)?.[0];
        expect(publishedStateEvent).toBeDefined();

        if (publishedStateEvent) {
          // Verify the tag is included
          const tagRef = publishedStateEvent.tags.find(([name]: string[]) => name === 'refs/tags/v1.0.0');
          expect(tagRef).toBeDefined();
          expect(tagRef![1]).toMatch(/^[0-9a-f]{40}$/);
        }
      });

      it('should publish state event with correct HEAD format on push', async () => {
        // Create a mock Git HTTP server that supports push
        const mockServer = new MockGitHttpServer();
        const mockRepo = createMockRepository();
        mockServer.addRepository('https://git.example.com/user/repo', mockRepo);

        // Create Nostr repository events
        const repoEvent: NostrEvent = {
          id: 'repo-event-id',
          pubkey: testPubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 30617,
          tags: [
            ['d', 'my-repo'],
            ['clone', 'https://git.example.com/user/repo.git'],
          ],
          content: '',
          sig: 'test-sig',
        };

        const stateEvent: NostrEvent = {
          id: 'state-event-id',
          pubkey: testPubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 30618,
          tags: [
            ['d', 'my-repo'],
            ['HEAD', 'ref: refs/heads/main'],
            ['refs/heads/main', '2e538da98e06b91e70268817b0fa3f01aeeb003e'],
          ],
          content: '',
          sig: 'test-sig',
        };

        vi.mocked(nostr.group).mockReturnValue({
          query: vi.fn(async () => [repoEvent, stateEvent]),
        } as unknown as ReturnType<NPool['group']>);

        const gitWithMock = new Git({
          fs,
          nostr,
          signer,
          systemAuthor: { name: 'Test User', email: 'test@example.com' },
          relayList: [{ url: new URL('wss://relay.example.com'), read: true, write: true }],
          fetch: mockServer.fetch,
        });

        // Clone the repository first
        await gitWithMock.clone({
          url: `nostr://${testNpub}/my-repo`,
          dir: '/push-test-repo',
          singleBranch: true,
          depth: 1,
        });

        // Make a local change
        await fs.mkdir('/push-test-repo/.shakespeare');
        await fs.writeFile('/push-test-repo/.shakespeare/git.json', JSON.stringify({ name: 'Test', email: 'test@test.com' }));
        await fs.writeFile('/push-test-repo/new-file.txt', 'new content');
        await gitWithMock.add({ dir: '/push-test-repo', filepath: 'new-file.txt' });
        await gitWithMock.commit({ dir: '/push-test-repo', message: 'Add new file' });

        // Clear the mock to track new calls
        vi.mocked(nostr.event).mockClear();

        // Push to Nostr (will fail on git push but state event should still be published)
        try {
          await gitWithMock.push({ dir: '/push-test-repo', remote: 'origin' });
        } catch {
          // Expected to fail because mock server doesn't support push
        }

        // Verify that the state event was published with correct format
        const eventCalls = vi.mocked(nostr.event).mock.calls;
        expect(eventCalls.length).toBeGreaterThanOrEqual(1);

        // Find the state event (kind 30618)
        const publishedStateEvent = eventCalls.find(([event]) => event.kind === 30618)?.[0];
        expect(publishedStateEvent).toBeDefined();

        if (publishedStateEvent) {
          // Verify the HEAD tag format matches NIP-34 spec
          const headTag = publishedStateEvent.tags.find(([name]: string[]) => name === 'HEAD');
          expect(headTag).toBeDefined();
          expect(headTag![1]).toMatch(/^ref: refs\/heads\//);

          // Verify refs/heads/main tag exists with a commit SHA
          const mainRefTag = publishedStateEvent.tags.find(([name]: string[]) => name === 'refs/heads/main');
          expect(mainRefTag).toBeDefined();
          expect(mainRefTag![1]).toMatch(/^[0-9a-f]{40}$/);
        }
      });
    });
  });
});
