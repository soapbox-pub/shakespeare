import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Git } from './git';
import git from 'isomorphic-git';
import type { NPool } from '@nostrify/nostrify';
import type { JSRuntimeFS } from './JSRuntime';
import { nip19 } from 'nostr-tools';

// Mock isomorphic-git
vi.mock('isomorphic-git');
vi.mock('isomorphic-git/http/web');
vi.mock('nostr-tools', () => ({
  nip19: {
    decode: vi.fn(),
    naddrEncode: vi.fn(),
  },
}));
vi.mock('@nostrify/nostrify', () => ({
  NIP05: {
    lookup: vi.fn(),
  },
}));
vi.mock('./configUtils', () => ({
  readGitSettings: vi.fn(),
}));

const mockGit = vi.mocked(git);

const createMockNostr = (): NPool => ({
  req: vi.fn(),
  query: vi.fn(),
  event: vi.fn(),
  group: vi.fn(),
  relay: vi.fn(),
  relays: new Map(),
  close: vi.fn(),
}) as unknown as NPool;

describe('Git', () => {
  const fs = {} as JSRuntimeFS;
  const nostr = createMockNostr();
  const corsProxy = 'https://cors.example.com';
  let gitInstance: Git;

  beforeEach(() => {
    vi.clearAllMocks();
    gitInstance = new Git({ fs, nostr, corsProxy });
  });

  describe('constructor', () => {
    it('creates instance with default regex when none provided', () => {
      const git = new Git({ fs, nostr, corsProxy });
      expect(git).toBeInstanceOf(Git);
    });


  });

  describe('clone', () => {
    beforeEach(() => {
      mockGit.clone = vi.fn().mockResolvedValue(undefined);
    });

    it('uses CORS proxy for all URLs', async () => {
      await gitInstance.clone({
        dir: '/test',
        url: 'https://github.com/user/repo.git',
      });

      expect(mockGit.clone).toHaveBeenCalledWith({
        fs,
        http: expect.any(Object),
        dir: '/test',
        url: 'https://github.com/user/repo.git',
      });
    });

    it('uses CORS proxy for GitLab URLs', async () => {
      await gitInstance.clone({
        dir: '/test',
        url: 'https://gitlab.com/user/repo.git',
      });

      expect(mockGit.clone).toHaveBeenCalledWith({
        fs,
        http: expect.any(Object),
        dir: '/test',
        url: 'https://gitlab.com/user/repo.git',
      });
    });

    it('uses CORS proxy for custom URLs', async () => {
      await gitInstance.clone({
        dir: '/test',
        url: 'https://custom.example.com/user/repo.git',
      });

      expect(mockGit.clone).toHaveBeenCalledWith({
        fs,
        http: expect.any(Object),
        dir: '/test',
        url: 'https://custom.example.com/user/repo.git',
      });
    });

    it('handles HTTP URLs correctly', async () => {
      await gitInstance.clone({
        dir: '/test',
        url: 'http://github.com/user/repo.git',
      });

      expect(mockGit.clone).toHaveBeenCalledWith({
        fs,
        http: expect.any(Object),
        dir: '/test',
        url: 'http://github.com/user/repo.git',
      });
    });
  });

  describe('getRemoteInfo', () => {
    beforeEach(() => {
      mockGit.getRemoteInfo = vi.fn().mockResolvedValue({});
    });

    it('uses CORS proxy for matching URLs', async () => {
      await gitInstance.getRemoteInfo({
        url: 'https://github.com/user/repo.git',
      });

      expect(mockGit.getRemoteInfo).toHaveBeenCalledWith({
        http: expect.any(Object),
        url: 'https://github.com/user/repo.git',
      });
    });

    it('uses CORS proxy for all URLs', async () => {
      await gitInstance.getRemoteInfo({
        url: 'https://custom.example.com/user/repo.git',
      });

      expect(mockGit.getRemoteInfo).toHaveBeenCalledWith({
        http: expect.any(Object),
        url: 'https://custom.example.com/user/repo.git',
      });
    });
  });

  describe('fetch with remote resolution', () => {
    beforeEach(() => {
      mockGit.fetch = vi.fn().mockResolvedValue(undefined);
      mockGit.listRemotes = vi.fn().mockResolvedValue([
        { remote: 'origin', url: 'https://github.com/user/repo.git' }
      ]);
    });

    it('uses CORS proxy for all fetch operations', async () => {
      await gitInstance.fetch({
        dir: '/test',
        remote: 'origin',
      });

      expect(mockGit.fetch).toHaveBeenCalledWith({
        fs,
        http: expect.any(Object),
        dir: '/test',
        remote: 'origin',
      });
    });

    it('handles fetch with direct URL parameter', async () => {
      await gitInstance.fetch({
        dir: '/test',
        url: 'https://gitlab.com/user/repo.git',
      });

      expect(mockGit.fetch).toHaveBeenCalledWith({
        fs,
        http: expect.any(Object),
        dir: '/test',
        url: 'https://gitlab.com/user/repo.git',
      });
    });
  });

  describe('Nostr URI cloning', () => {
    beforeEach(() => {
      mockGit.clone = vi.fn().mockResolvedValue(undefined);
      mockGit.deleteRemote = vi.fn().mockResolvedValue(undefined);
      mockGit.addRemote = vi.fn().mockResolvedValue(undefined);

      // Mock nip19 decode
      vi.mocked(nip19.decode).mockReturnValue({
        type: 'npub',
        data: 'abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab'
      });

      // Mock Nostr query to return a repository event
      const mockRelay = {
        query: vi.fn().mockResolvedValue([{
          id: 'event123',
          pubkey: 'abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
          kind: 30617,
          content: '',
          tags: [
            ['d', 'my-repo'],
            ['clone', 'https://github.com/user/repo.git', 'https://gitlab.com/user/repo.git'],
          ],
          created_at: Date.now(),
          sig: 'signature'
        }])
      };

      nostr.group = vi.fn().mockReturnValue(mockRelay);
      nostr.relay = vi.fn().mockReturnValue(mockRelay);
    });

    it('successfully clones from Nostr URI and updates origin remote', async () => {
      const nostrUrl = 'nostr://npub1abc123/my-repo';

      await gitInstance.clone({
        dir: '/test',
        url: nostrUrl,
      });

      // Should attempt to clone from the first URL
      expect(mockGit.clone).toHaveBeenCalledWith({
        fs,
        http: expect.any(Object),
        dir: '/test',
        url: 'https://github.com/user/repo.git',
      });

      // Should delete the existing origin remote
      expect(mockGit.deleteRemote).toHaveBeenCalledWith({
        fs,
        dir: '/test',
        remote: 'origin',
      });

      // Should add the Nostr URI as the new origin
      expect(mockGit.addRemote).toHaveBeenCalledWith({
        fs,
        dir: '/test',
        remote: 'origin',
        url: nostrUrl,
      });
    });
  });

  describe('setRemoteURL', () => {
    beforeEach(() => {
      mockGit.deleteRemote = vi.fn().mockResolvedValue(undefined);
      mockGit.addRemote = vi.fn().mockResolvedValue(undefined);
    });

    it('updates remote URL by deleting and re-adding remote', async () => {
      await gitInstance.setRemoteURL({
        dir: '/test',
        remote: 'origin',
        url: 'https://new-repo.com/user/repo.git',
      });

      expect(mockGit.deleteRemote).toHaveBeenCalledWith({
        fs,
        dir: '/test',
        remote: 'origin',
      });

      expect(mockGit.addRemote).toHaveBeenCalledWith({
        fs,
        dir: '/test',
        remote: 'origin',
        url: 'https://new-repo.com/user/repo.git',
      });
    });

    it('works with any remote name', async () => {
      await gitInstance.setRemoteURL({
        dir: '/test',
        remote: 'upstream',
        url: 'nostr://npub1abc123/my-repo',
      });

      expect(mockGit.deleteRemote).toHaveBeenCalledWith({
        fs,
        dir: '/test',
        remote: 'upstream',
      });

      expect(mockGit.addRemote).toHaveBeenCalledWith({
        fs,
        dir: '/test',
        remote: 'upstream',
        url: 'nostr://npub1abc123/my-repo',
      });
    });
  });

  describe('commit with Git identity settings', () => {
    beforeEach(() => {
      mockGit.commit = vi.fn().mockResolvedValue('abc123');
    });

    it('uses shakespeare.diy as default author when no Git identity is configured', async () => {
      const { readGitSettings } = await import('./configUtils');
      vi.mocked(readGitSettings).mockResolvedValue({
        credentials: {},
        hostTokens: {},
        coAuthorEnabled: true,
      });

      await gitInstance.commit({
        dir: '/test',
        message: 'Test commit',
      });

      expect(mockGit.commit).toHaveBeenCalledWith({
        fs,
        dir: '/test',
        message: 'Test commit',
        author: {
          name: 'shakespeare.diy',
          email: 'assistant@shakespeare.diy',
        },
        committer: {
          name: 'shakespeare.diy',
          email: 'assistant@shakespeare.diy',
        },
      });
    });

    it('uses custom identity when both name and email are configured', async () => {
      const { readGitSettings } = await import('./configUtils');
      vi.mocked(readGitSettings).mockResolvedValue({
        credentials: {},
        hostTokens: {},
        name: 'John Doe',
        email: 'john@example.com',
        coAuthorEnabled: true,
      });

      await gitInstance.commit({
        dir: '/test',
        message: 'Test commit',
      });

      expect(mockGit.commit).toHaveBeenCalledWith({
        fs,
        dir: '/test',
        message: 'Test commit\n\nCo-authored-by: shakespeare.diy <assistant@shakespeare.diy>',
        author: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        committer: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      });
    });

    it('does not add co-author when coAuthorEnabled is false', async () => {
      const { readGitSettings } = await import('./configUtils');
      vi.mocked(readGitSettings).mockResolvedValue({
        credentials: {},
        hostTokens: {},
        name: 'John Doe',
        email: 'john@example.com',
        coAuthorEnabled: false,
      });

      await gitInstance.commit({
        dir: '/test',
        message: 'Test commit',
      });

      expect(mockGit.commit).toHaveBeenCalledWith({
        fs,
        dir: '/test',
        message: 'Test commit',
        author: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        committer: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      });
    });

    it('respects provided author when explicitly passed', async () => {
      const { readGitSettings } = await import('./configUtils');
      vi.mocked(readGitSettings).mockResolvedValue({
        credentials: {},
        hostTokens: {},
        name: 'John Doe',
        email: 'john@example.com',
        coAuthorEnabled: true,
      });

      await gitInstance.commit({
        dir: '/test',
        message: 'Test commit',
        author: {
          name: 'Custom Author',
          email: 'custom@example.com',
        },
        committer: {
          name: 'Custom Committer',
          email: 'committer@example.com',
        },
      });

      expect(mockGit.commit).toHaveBeenCalledWith({
        fs,
        dir: '/test',
        message: 'Test commit',
        author: {
          name: 'Custom Author',
          email: 'custom@example.com',
        },
        committer: {
          name: 'Custom Committer',
          email: 'committer@example.com',
        },
      });
    });
  });

  describe('Nostr push with fast-forward checking', () => {
    const mockSigner = {
      signEvent: vi.fn().mockResolvedValue({
        id: 'state123',
        pubkey: 'abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
        kind: 30618,
        content: '',
        tags: [],
        created_at: Date.now(),
        sig: 'signature',
      }),
      getPublicKey: vi.fn().mockResolvedValue('abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab'),
    };

    beforeEach(() => {
      // Mock timers to avoid waiting 5 seconds
      vi.useFakeTimers();

      mockGit.push = vi.fn().mockResolvedValue(undefined);
      mockGit.listRemotes = vi.fn().mockResolvedValue([
        { remote: 'origin', url: 'nostr://npub1abc123/my-repo' }
      ]);
      mockGit.listRefs = vi.fn().mockResolvedValue(['refs/heads/main']);
      mockGit.resolveRef = vi.fn().mockResolvedValue('localcommit123');
      mockGit.isDescendent = vi.fn().mockResolvedValue(true);
      mockGit.currentBranch = vi.fn().mockResolvedValue('main');
      mockGit.readCommit = vi.fn().mockResolvedValue({});

      // Mock nip19 decode
      vi.mocked(nip19.decode).mockReturnValue({
        type: 'npub',
        data: 'abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab'
      });

      vi.mocked(nip19.naddrEncode).mockReturnValue('naddr1...');

      // Mock Nostr query to return repository and state events
      const mockRelay = {
        query: vi.fn().mockResolvedValue([
          {
            id: 'repo123',
            pubkey: 'abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
            kind: 30617,
            content: '',
            tags: [
              ['d', 'my-repo'],
              ['clone', 'https://github.com/user/repo.git'],
            ],
            created_at: Date.now(),
            sig: 'signature',
          },
          {
            id: 'state123',
            pubkey: 'abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
            kind: 30618,
            content: '',
            tags: [
              ['d', 'my-repo'],
              ['refs/heads/main', 'remotecommit456'],
              ['HEAD', 'ref: refs/heads/main'],
            ],
            created_at: Date.now(),
            sig: 'signature',
          },
        ]),
      };

      nostr.group = vi.fn().mockReturnValue(mockRelay);
      nostr.relay = vi.fn().mockReturnValue(mockRelay);
      nostr.event = vi.fn().mockResolvedValue(undefined);

      mockGit.setConfig = vi.fn().mockResolvedValue(undefined);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('rejects non-fast-forward push without --force flag', async () => {
      // Mock isDescendent to return false (not a fast-forward)
      mockGit.isDescendent = vi.fn().mockResolvedValue(false);

      await expect(
        gitInstance.push({
          dir: '/test',
          remote: 'origin',
          ref: 'main',
          force: false,
          signer: mockSigner,
        })
      ).rejects.toThrow('Updates were rejected');
    });

    it('allows non-fast-forward push with --force flag', async () => {
      // Mock isDescendent to return false (not a fast-forward)
      mockGit.isDescendent = vi.fn().mockResolvedValue(false);

      // Should not throw with force flag
      const pushPromise = gitInstance.push({
        dir: '/test',
        remote: 'origin',
        ref: 'main',
        force: true,
        signer: mockSigner,
      });

      // Advance timers to skip the 5 second wait
      await vi.advanceTimersByTimeAsync(5000);

      await pushPromise;

      // Should have attempted to push to the Git remote
      expect(mockGit.push).toHaveBeenCalled();
    });

    it('allows fast-forward push without --force flag', async () => {
      // Mock isDescendent to return true (is a fast-forward)
      mockGit.isDescendent = vi.fn().mockResolvedValue(true);

      // Should not throw
      const pushPromise = gitInstance.push({
        dir: '/test',
        remote: 'origin',
        ref: 'main',
        force: false,
        signer: mockSigner,
      });

      // Advance timers to skip the 5 second wait
      await vi.advanceTimersByTimeAsync(5000);

      await pushPromise;

      // Should have attempted to push to the Git remote
      expect(mockGit.push).toHaveBeenCalled();
    });

    it('returns early when commits are already up-to-date', async () => {
      // Mock resolveRef to return the same commit as remote
      mockGit.resolveRef = vi.fn().mockResolvedValue('remotecommit456');

      await gitInstance.push({
        dir: '/test',
        remote: 'origin',
        ref: 'main',
        force: false,
        signer: mockSigner,
      });

      // Should not have attempted to push (already up-to-date)
      expect(mockGit.push).not.toHaveBeenCalled();
    });

    it('skips fast-forward check when no state event exists', async () => {
      // Mock Nostr query to return only repo event (no state)
      const mockRelay = {
        query: vi.fn().mockResolvedValue([
          {
            id: 'repo123',
            pubkey: 'abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
            kind: 30617,
            content: '',
            tags: [
              ['d', 'my-repo'],
              ['clone', 'https://github.com/user/repo.git'],
            ],
            created_at: Date.now(),
            sig: 'signature',
          },
        ]),
      };

      nostr.group = vi.fn().mockReturnValue(mockRelay);
      nostr.relay = vi.fn().mockReturnValue(mockRelay);

      // Should not throw even if not a fast-forward (no state to check against)
      const pushPromise = gitInstance.push({
        dir: '/test',
        remote: 'origin',
        ref: 'main',
        force: false,
        signer: mockSigner,
      });

      // Advance timers to skip the 5 second wait
      await vi.advanceTimersByTimeAsync(5000);

      await pushPromise;

      // Should have attempted to push
      expect(mockGit.push).toHaveBeenCalled();
    });

    it('skips fast-forward check when state has no matching ref', async () => {
      // Mock Nostr query to return state with different ref
      const mockRelay = {
        query: vi.fn().mockResolvedValue([
          {
            id: 'repo123',
            pubkey: 'abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
            kind: 30617,
            content: '',
            tags: [
              ['d', 'my-repo'],
              ['clone', 'https://github.com/user/repo.git'],
            ],
            created_at: Date.now(),
            sig: 'signature',
          },
          {
            id: 'state123',
            pubkey: 'abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
            kind: 30618,
            content: '',
            tags: [
              ['d', 'my-repo'],
              ['refs/heads/develop', 'othercommit789'],
              ['HEAD', 'ref: refs/heads/develop'],
            ],
            created_at: Date.now(),
            sig: 'signature',
          },
        ]),
      };

      nostr.group = vi.fn().mockReturnValue(mockRelay);
      nostr.relay = vi.fn().mockReturnValue(mockRelay);

      // Should not throw (no matching ref in state)
      const pushPromise = gitInstance.push({
        dir: '/test',
        remote: 'origin',
        ref: 'main',
        force: false,
        signer: mockSigner,
      });

      // Advance timers to skip the 5 second wait
      await vi.advanceTimersByTimeAsync(5000);

      await pushPromise;

      // Should have attempted to push
      expect(mockGit.push).toHaveBeenCalled();
    });

    it('publishes new state event to Nostr relays', async () => {
      mockGit.isDescendent = vi.fn().mockResolvedValue(true);

      const mockGroupRelay = {
        query: vi.fn().mockResolvedValue([
          {
            id: 'repo123',
            pubkey: 'abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
            kind: 30617,
            content: '',
            tags: [
              ['d', 'my-repo'],
              ['clone', 'https://github.com/user/repo.git'],
            ],
            created_at: Date.now(),
            sig: 'signature',
          },
          {
            id: 'state123',
            pubkey: 'abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
            kind: 30618,
            content: '',
            tags: [
              ['d', 'my-repo'],
              ['refs/heads/main', 'remotecommit456'],
              ['HEAD', 'ref: refs/heads/main'],
            ],
            created_at: Date.now(),
            sig: 'signature',
          },
        ]),
        event: vi.fn().mockResolvedValue(undefined),
      };

      nostr.group = vi.fn().mockReturnValue(mockGroupRelay);

      const pushPromise = gitInstance.push({
        dir: '/test',
        remote: 'origin',
        ref: 'main',
        force: false,
        signer: mockSigner,
      });

      // Advance timers to skip the 5 second wait
      await vi.advanceTimersByTimeAsync(5000);

      await pushPromise;

      // Should have signed a new state event
      expect(mockSigner.signEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 30618,
          tags: expect.arrayContaining([
            ['d', 'my-repo'],
          ]),
        })
      );

      // Should have published the state event to Nostr via group
      expect(mockGroupRelay.event).toHaveBeenCalled();
    });
  });
});