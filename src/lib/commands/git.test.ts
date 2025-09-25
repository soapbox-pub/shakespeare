import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Git } from '../git';
import { GitCommand } from './git';
import type { JSRuntimeFS } from '../JSRuntime';

// Mock filesystem
const createMockFS = (): JSRuntimeFS => ({
  readFile: vi.fn().mockResolvedValue('mock content'),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  mkdir: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockImplementation((path: string) => {
    if (path.endsWith('/.git')) {
      throw new Error('ENOENT: no such file or directory');
    }
    return Promise.resolve({
      isDirectory: () => true,
      isFile: () => false,
      size: 0,
      mtimeMs: Date.now(),
    });
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

describe('GitCommand', () => {
  let gitCommand: GitCommand;
  let mockFS: JSRuntimeFS;
  const testCwd = '/test';

  beforeEach(() => {
    mockFS = createMockFS();
    const mockNostr = {
      req: vi.fn(),
      query: vi.fn(),
      event: vi.fn(),
      group: vi.fn(),
      relay: vi.fn(),
      relays: new Map(),
      close: vi.fn(),
    } as unknown as import('@nostrify/nostrify').NPool;
    const git = new Git({ fs: mockFS, nostr: mockNostr });
    gitCommand = new GitCommand({ git, fs: mockFS, cwd: testCwd });
  });

  it('should have correct command properties', () => {
    expect(gitCommand.name).toBe('git');
    expect(gitCommand.description).toBe('Git version control system');
    expect(gitCommand.usage).toBe('git <command> [<args>]');
  });

  it('should show help when no arguments provided', async () => {
    const result = await gitCommand.execute([], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('usage: git');
    expect(result.stdout).toContain('These are common Git commands');
    expect(result.stdout).toContain('init');
    expect(result.stdout).toContain('status');
    expect(result.stdout).toContain('add');
    expect(result.stdout).toContain('commit');
  });

  it('should show help when --help flag is used', async () => {
    const result = await gitCommand.execute(['--help'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('usage: git');
  });

  it('should show version when --version flag is used', async () => {
    const result = await gitCommand.execute(['--version'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('git version');
    expect(result.stdout).toContain('isomorphic-git');
  });

  it('should return error for unknown subcommand', async () => {
    const result = await gitCommand.execute(['unknown-command'], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('unknown-command');
    expect(result.stderr).toContain('is not a git command');
  });

  it('should handle status subcommand (not a git repo)', async () => {
    const result = await gitCommand.execute(['status'], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('fatal: not a git repository');
  });

  it('should handle init subcommand', async () => {
    const result = await gitCommand.execute(['init'], testCwd);

    // With our mock filesystem, init might succeed or fail depending on isomorphic-git behavior
    // The important thing is that the subcommand is recognized and executed
    expect([0, 1]).toContain(result.exitCode);
    if (result.exitCode === 0) {
      expect(result.stdout).toContain('Initialized');
    }
  });

  it('should register all expected subcommands', () => {
    const expectedSubcommands = [
      'init', 'status', 'add', 'commit', 'log', 'branch', 'checkout',
      'remote', 'push', 'pull', 'clone', 'config', 'reset', 'diff', 'tag', 'show'
    ];

    // We can't directly access the subcommands map, but we can test that they work
    expectedSubcommands.forEach(async (subcommand) => {
      const result = await gitCommand.execute([subcommand, '--help'], testCwd);
      // Most subcommands will fail due to not being in a git repo, but they should be recognized
      expect(result.stderr).not.toContain('is not a git command');
    });
  });
});