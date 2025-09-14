import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitResetCommand } from './reset';
import type { JSRuntimeFS } from '../../JSRuntime';

// Mock isomorphic-git
vi.mock('isomorphic-git', () => ({
  default: {
    resolveRef: vi.fn(),
    resetIndex: vi.fn(),
    readCommit: vi.fn(),
    writeRef: vi.fn(),
    checkout: vi.fn(),
  },
}));

import git from 'isomorphic-git';

// Mock filesystem
const createMockFS = (): JSRuntimeFS => ({
  readFile: vi.fn().mockResolvedValue('mock content'),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  mkdir: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockImplementation((path: string) => {
    if (path.endsWith('/.git')) {
      return Promise.resolve({
        isDirectory: () => true,
        isFile: () => false,
        size: 0,
        mtimeMs: Date.now(),
      });
    }
    throw new Error('ENOENT: no such file or directory');
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

describe('GitResetCommand', () => {
  let resetCommand: GitResetCommand;
  let mockFS: JSRuntimeFS;
  const testCwd = '/test';

  beforeEach(() => {
    mockFS = createMockFS();
    resetCommand = new GitResetCommand();
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  it('should have correct command properties', () => {
    expect(resetCommand.name).toBe('reset');
    expect(resetCommand.description).toBe('Reset current HEAD to the specified state');
    expect(resetCommand.usage).toContain('git reset');
  });

  it('should fail when not in a git repository', async () => {
    // Mock stat to throw for .git directory
    mockFS.stat = vi.fn().mockRejectedValue(new Error('ENOENT'));

    const result = await resetCommand.execute(['--hard', 'HEAD'], testCwd, mockFS);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('fatal: not a git repository');
  });

  it('should handle git reset --hard HEAD', async () => {
    const currentOid = 'abc123def456';
    const targetOid = 'def456abc123';

    // Mock git operations - different OIDs to avoid the same commit case
    vi.mocked(git.resolveRef)
      .mockResolvedValueOnce(targetOid) // First call for target
      .mockResolvedValueOnce(currentOid); // Second call for current HEAD
    vi.mocked(git.readCommit).mockResolvedValue({
      oid: targetOid,
      commit: {
        tree: 'tree123',
        parent: [],
        author: { name: 'Test', email: 'test@example.com', timestamp: 123456789, timezoneOffset: 0 },
        committer: { name: 'Test', email: 'test@example.com', timestamp: 123456789, timezoneOffset: 0 },
        message: 'Test commit',
      },
      payload: 'mock payload',
    });
    vi.mocked(git.writeRef).mockResolvedValue(undefined);
    vi.mocked(git.checkout).mockResolvedValue(undefined);

    const result = await resetCommand.execute(['--hard', 'HEAD'], testCwd, mockFS);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('HEAD is now at');
    expect(git.resolveRef).toHaveBeenCalledWith({
      fs: mockFS,
      dir: testCwd,
      ref: 'HEAD',
    });
    expect(git.writeRef).toHaveBeenCalledWith({
      fs: mockFS,
      dir: testCwd,
      ref: 'HEAD',
      value: targetOid,
    });
    expect(git.checkout).toHaveBeenCalledWith({
      fs: mockFS,
      dir: testCwd,
      ref: targetOid,
      force: true,
    });
  });

  it('should handle git reset HEAD (mixed mode)', async () => {
    const currentOid = 'abc123def456';
    const targetOid = 'def456abc123';

    // Mock git operations - different OIDs to avoid the same commit case
    vi.mocked(git.resolveRef)
      .mockResolvedValueOnce(targetOid) // First call for target
      .mockResolvedValueOnce(currentOid); // Second call for current HEAD
    vi.mocked(git.checkout).mockResolvedValue(undefined);

    const result = await resetCommand.execute(['HEAD'], testCwd, mockFS);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('HEAD is now at');
    expect(git.checkout).toHaveBeenCalledWith({
      fs: mockFS,
      dir: testCwd,
      ref: 'HEAD',
      noCheckout: true,
    });
  });

  it('should handle file-specific reset', async () => {
    vi.mocked(git.resetIndex).mockResolvedValue(undefined);

    const result = await resetCommand.execute(['HEAD', 'file.txt'], testCwd, mockFS);

    expect(result.exitCode).toBe(0);
    expect(git.resetIndex).toHaveBeenCalledWith({
      fs: mockFS,
      dir: testCwd,
      filepath: 'file.txt',
    });
  });

  it('should handle unknown commit reference', async () => {
    // Mock the first call to resolveRef (for the target) to throw
    vi.mocked(git.resolveRef).mockRejectedValue(new Error('Unknown ref'));

    // Use a commit hash that looks valid but doesn't exist
    const result = await resetCommand.execute(['--hard', 'abc123def456'], testCwd, mockFS);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('unknown revision or path not in the working tree');
  });

  it('should handle soft reset (not implemented)', async () => {
    const currentOid = 'abc123def456';
    const targetOid = 'def456abc123';

    // Mock different OIDs to avoid the same commit case
    vi.mocked(git.resolveRef)
      .mockResolvedValueOnce(targetOid) // First call for target
      .mockResolvedValueOnce(currentOid); // Second call for current HEAD

    const result = await resetCommand.execute(['--soft', 'HEAD'], testCwd, mockFS);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--soft reset is not implemented');
  });

  it('should handle same commit (no-op)', async () => {
    const mockOid = 'abc123def456';

    // Mock both HEAD and target to resolve to the same OID
    vi.mocked(git.resolveRef)
      .mockResolvedValueOnce(mockOid) // First call for target
      .mockResolvedValueOnce(mockOid); // Second call for current HEAD

    const result = await resetCommand.execute(['--hard', 'HEAD'], testCwd, mockFS);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
    expect(git.writeRef).not.toHaveBeenCalled();
    expect(git.checkout).not.toHaveBeenCalled();
  });
});