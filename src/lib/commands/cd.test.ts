import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CdCommand } from './cd';
import type { JSRuntimeFS } from '../JSRuntime';

// Mock filesystem
const createMockFS = (): JSRuntimeFS => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  mkdir: vi.fn(),
  stat: vi.fn(),
  lstat: vi.fn(),
  unlink: vi.fn(),
  rmdir: vi.fn(),
  rename: vi.fn(),
  readlink: vi.fn(),
  symlink: vi.fn(),
});

describe('CdCommand', () => {
  let mockFS: JSRuntimeFS;
  let cdCommand: CdCommand;
  const testCwd = '/test/current/dir';

  beforeEach(() => {
    mockFS = createMockFS();
    cdCommand = new CdCommand(mockFS);
  });

  it('should have correct command properties', () => {
    expect(cdCommand.name).toBe('cd');
    expect(cdCommand.description).toBe('Change directory');
    expect(cdCommand.usage).toBe('cd [directory]');
  });

  it('should change to specified directory', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    const result = await cdCommand.execute(['subdir'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.newCwd).toBe('/test/current/dir/subdir');
    expect(result.stderr).toBe('');
  });

  it('should handle current directory (.)', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    const result = await cdCommand.execute(['.'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.newCwd).toBe(testCwd);
  });

  it('should handle parent directory (..)', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    const result = await cdCommand.execute(['..'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.newCwd).toBe('/test/current');
  });

  it('should stay in current directory when no arguments', async () => {
    const result = await cdCommand.execute([], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.newCwd).toBe(testCwd);
  });

  it('should return error for non-existent directory', async () => {
    vi.mocked(mockFS.stat).mockRejectedValue(new Error('ENOENT: no such file or directory'));

    const result = await cdCommand.execute(['nonexistent'], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No such file or directory');
  });

  it('should return error when target is not a directory', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });

    const result = await cdCommand.execute(['file.txt'], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Not a directory');
  });

  it('should reject absolute paths', async () => {
    const result = await cdCommand.execute(['/absolute/path'], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('absolute paths are not supported');
  });

  it('should reject too many arguments', async () => {
    const result = await cdCommand.execute(['dir1', 'dir2'], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('too many arguments');
  });
});