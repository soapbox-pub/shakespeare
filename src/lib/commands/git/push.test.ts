import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitPushCommand } from './push';
import type { Git } from '../../git';
import type { JSRuntimeFS } from '../../JSRuntime';

// Mock filesystem
const createMockFS = (): JSRuntimeFS => ({
  readFile: vi.fn().mockResolvedValue('mock content'),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  mkdir: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({
    isDirectory: () => true,
    isFile: () => false,
    size: 0,
    mtimeMs: Date.now(),
  }),
  lstat: vi.fn().mockResolvedValue({
    isDirectory: () => true,
    isFile: () => false,
    size: 0,
    mtimeMs: Date.now(),
  }),
  unlink: vi.fn().mockResolvedValue(undefined),
  rmdir: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  readlink: vi.fn().mockResolvedValue('mock link'),
  symlink: vi.fn().mockResolvedValue(undefined),
});

describe('GitPushCommand', () => {
  let pushCommand: GitPushCommand;
  let mockGit: Git;
  let mockFS: JSRuntimeFS;
  const testPwd = '/test';

  beforeEach(() => {
    mockFS = createMockFS();
    mockGit = {
      currentBranch: vi.fn().mockResolvedValue('main'),
      listRemotes: vi.fn().mockResolvedValue([
        { remote: 'origin', url: 'https://github.com/test/repo.git' }
      ]),
      push: vi.fn().mockResolvedValue(undefined),
    } as any;

    pushCommand = new GitPushCommand({
      git: mockGit,
      fs: mockFS,
      pwd: testPwd,
    });
  });

  it('should have correct command properties', () => {
    expect(pushCommand.name).toBe('push');
    expect(pushCommand.description).toBe('Update remote refs along with associated objects');
    expect(pushCommand.usage).toBe('git push [<remote>] [<branch>]');
  });

  describe('argument parsing', () => {
    it('should parse "origin main" correctly', () => {
      // Access the private parseArgs method for testing
      const parseArgs = (pushCommand as any).parseArgs.bind(pushCommand);
      const result = parseArgs(['origin', 'main']);

      expect(result).toEqual({
        remote: 'origin',
        branch: 'main',
        options: { force: false, setUpstream: false }
      });
    });

    it('should use default remote "origin" when no arguments provided', () => {
      const parseArgs = (pushCommand as any).parseArgs.bind(pushCommand);
      const result = parseArgs([]);

      expect(result).toEqual({
        remote: 'origin',
        branch: undefined,
        options: { force: false, setUpstream: false }
      });
    });

    it('should parse remote only', () => {
      const parseArgs = (pushCommand as any).parseArgs.bind(pushCommand);
      const result = parseArgs(['upstream']);

      expect(result).toEqual({
        remote: 'upstream',
        branch: undefined,
        options: { force: false, setUpstream: false }
      });
    });

    it('should parse remote and branch', () => {
      const parseArgs = (pushCommand as any).parseArgs.bind(pushCommand);
      const result = parseArgs(['upstream', 'feature-branch']);

      expect(result).toEqual({
        remote: 'upstream',
        branch: 'feature-branch',
        options: { force: false, setUpstream: false }
      });
    });

    it('should parse force flag', () => {
      const parseArgs = (pushCommand as any).parseArgs.bind(pushCommand);
      const result = parseArgs(['--force', 'origin', 'main']);

      expect(result).toEqual({
        remote: 'origin',
        branch: 'main',
        options: { force: true, setUpstream: false }
      });
    });

    it('should parse set-upstream flag', () => {
      const parseArgs = (pushCommand as any).parseArgs.bind(pushCommand);
      const result = parseArgs(['-u', 'origin', 'main']);

      expect(result).toEqual({
        remote: 'origin',
        branch: 'main',
        options: { force: false, setUpstream: true }
      });
    });

    it('should handle mixed flags and arguments', () => {
      const parseArgs = (pushCommand as any).parseArgs.bind(pushCommand);
      const result = parseArgs(['--force', 'upstream', '--set-upstream', 'feature']);

      expect(result).toEqual({
        remote: 'upstream',
        branch: 'feature',
        options: { force: true, setUpstream: true }
      });
    });
  });

  describe('execution', () => {
    it('should fail when not in a git repository', async () => {
      // Mock stat to throw error (no .git directory)
      mockFS.stat = vi.fn().mockRejectedValue(new Error('ENOENT'));

      const result = await pushCommand.execute(['origin', 'main']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('fatal: not a git repository');
    });

    it('should fail when remote does not exist', async () => {
      // Mock listRemotes to return empty array
      mockGit.listRemotes = vi.fn().mockResolvedValue([]);

      const result = await pushCommand.execute(['nonexistent', 'main']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("fatal: 'nonexistent' does not appear to be a git repository");
    });

    it('should use current branch when no branch specified', async () => {
      mockGit.currentBranch = vi.fn().mockResolvedValue('feature-branch');

      const result = await pushCommand.execute(['origin']);

      expect(mockGit.push).toHaveBeenCalledWith({
        dir: testPwd,
        remote: 'origin',
        ref: 'feature-branch',
        remoteRef: 'feature-branch',
      });
    });

    it('should use specified branch', async () => {
      const result = await pushCommand.execute(['origin', 'main']);

      expect(mockGit.push).toHaveBeenCalledWith({
        dir: testPwd,
        remote: 'origin',
        ref: 'main',
        remoteRef: 'main',
      });
    });
  });
});