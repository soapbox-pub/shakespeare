import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Git } from './git';
import type { JSRuntimeFS } from './JSRuntime';
import type { NPool, NostrEvent } from '@nostrify/nostrify';
import { NSecSigner } from '@nostrify/nostrify';
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
