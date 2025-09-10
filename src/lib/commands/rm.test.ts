import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RmCommand } from './rm';
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

describe('RmCommand', () => {
  let mockFS: JSRuntimeFS;
  let rmCommand: RmCommand;
  const testCwd = '/test/dir';

  beforeEach(() => {
    mockFS = createMockFS();
    rmCommand = new RmCommand(mockFS);
  });

  it('should have correct command properties', () => {
    expect(rmCommand.name).toBe('rm');
    expect(rmCommand.description).toBe('Remove files and directories');
    expect(rmCommand.usage).toBe('rm [-rf] file...');
  });

  it('should remove a file', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    vi.mocked(mockFS.unlink).mockResolvedValue();

    const result = await rmCommand.execute(['file.txt'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(mockFS.unlink).toHaveBeenCalledWith('/test/dir/file.txt');
  });

  it('should return error when trying to remove directory without -r', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    const result = await rmCommand.execute(['somedir'], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Is a directory');
  });

  it('should remove directory with -r flag', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });
    vi.mocked(mockFS.readdir).mockResolvedValue([]);
    vi.mocked(mockFS.rmdir).mockResolvedValue();

    const result = await rmCommand.execute(['-r', 'somedir'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(mockFS.rmdir).toHaveBeenCalledWith('/test/dir/somedir');
  });

  it('should return error for non-existent file', async () => {
    vi.mocked(mockFS.stat).mockRejectedValue(new Error('ENOENT: no such file or directory'));

    const result = await rmCommand.execute(['nonexistent.txt'], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No such file or directory');
  });

  it('should ignore errors with -f flag', async () => {
    vi.mocked(mockFS.stat).mockRejectedValue(new Error('ENOENT: no such file or directory'));

    const result = await rmCommand.execute(['-f', 'nonexistent.txt'], testCwd);

    expect(result.exitCode).toBe(0);
  });

  it('should reject absolute paths', async () => {
    const result = await rmCommand.execute(['/absolute/path'], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('absolute paths are not supported');
  });

  it('should reject removing current or parent directory', async () => {
    const result1 = await rmCommand.execute(['.'], testCwd);
    expect(result1.exitCode).toBe(1);
    expect(result1.stderr).toContain('Invalid argument');

    const result2 = await rmCommand.execute(['..'], testCwd);
    expect(result2.exitCode).toBe(1);
    expect(result2.stderr).toContain('Invalid argument');
  });

  it('should return error when no operand provided', async () => {
    const result = await rmCommand.execute([], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('missing operand');
  });
});