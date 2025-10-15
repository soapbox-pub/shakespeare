import { describe, it, expect, vi, beforeEach } from 'vitest';
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
            ['clone', 'https://github.com/user/repo.git'],
            ['clone', 'https://gitlab.com/user/repo.git']
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
});