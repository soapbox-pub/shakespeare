import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Git } from './git';
import git from 'isomorphic-git';
import type { NPool } from '@nostrify/nostrify';
import type { JSRuntimeFS } from './JSRuntime';

// Mock isomorphic-git
vi.mock('isomorphic-git');
vi.mock('isomorphic-git/http/web');

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
        corsProxy: 'https://cors.example.com',
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
        corsProxy: 'https://cors.example.com',
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
        corsProxy: 'https://cors.example.com',
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
        corsProxy: 'https://cors.example.com',
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
        corsProxy: 'https://cors.example.com',
        url: 'https://github.com/user/repo.git',
      });
    });

    it('uses CORS proxy for all URLs', async () => {
      await gitInstance.getRemoteInfo({
        url: 'https://custom.example.com/user/repo.git',
      });

      expect(mockGit.getRemoteInfo).toHaveBeenCalledWith({
        http: expect.any(Object),
        corsProxy: 'https://cors.example.com',
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
        corsProxy: 'https://cors.example.com',
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
        corsProxy: 'https://cors.example.com',
        dir: '/test',
        url: 'https://gitlab.com/user/repo.git',
      });
    });
  });
});