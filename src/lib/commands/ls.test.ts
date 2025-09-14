import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LsCommand } from './ls';
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

describe('LsCommand', () => {
  let mockFS: JSRuntimeFS;
  let lsCommand: LsCommand;
  const testCwd = '/test/dir';

  beforeEach(() => {
    mockFS = createMockFS();
    lsCommand = new LsCommand(mockFS);
  });

  it('should have correct command properties', () => {
    expect(lsCommand.name).toBe('ls');
    expect(lsCommand.description).toBe('List directory contents');
    expect(lsCommand.usage).toBe('ls [-la] [file...]');
  });

  it('should list current directory when no arguments', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });
    vi.mocked(mockFS.readdir).mockResolvedValue([
      { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
      { name: 'dir1', isDirectory: () => true, isFile: () => false },
    ]);

    const result = await lsCommand.execute([], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('dir1/');
    expect(result.stdout).toContain('file1.txt');
  });

  it('should show file info when targeting a file', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
      size: 1024,
    });

    const result = await lsCommand.execute(['test.txt'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('test.txt');
  });

  it('should show long format with -l flag', async () => {
    vi.mocked(mockFS.stat)
      .mockResolvedValueOnce({
        isDirectory: () => true,
        isFile: () => false,
      })
      .mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
        size: 1024,
        mtimeMs: Date.now(),
      });

    vi.mocked(mockFS.readdir).mockResolvedValue([
      { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
    ]);

    const result = await lsCommand.execute(['-l'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('-rw-r--r--');
    expect(result.stdout).toContain('1024');
    expect(result.stdout).toContain('file1.txt');
  });

  it('should show hidden files with -a flag', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });
    vi.mocked(mockFS.readdir).mockResolvedValue([
      { name: '.hidden', isDirectory: () => false, isFile: () => true },
      { name: 'visible.txt', isDirectory: () => false, isFile: () => true },
    ]);

    const result = await lsCommand.execute(['-a'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('.hidden');
    expect(result.stdout).toContain('visible.txt');
  });

  it('should not show hidden files by default', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });
    vi.mocked(mockFS.readdir).mockResolvedValue([
      { name: '.hidden', isDirectory: () => false, isFile: () => true },
      { name: 'visible.txt', isDirectory: () => false, isFile: () => true },
    ]);

    const result = await lsCommand.execute([], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain('.hidden');
    expect(result.stdout).toContain('visible.txt');
  });

  it('should return error for non-existent path', async () => {
    vi.mocked(mockFS.stat).mockRejectedValue(new Error('ENOENT: no such file or directory'));

    const result = await lsCommand.execute(['nonexistent'], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No such file or directory');
  });

  it('should handle absolute paths', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });
    vi.mocked(mockFS.readdir).mockResolvedValue([
      { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
    ]);

    const result = await lsCommand.execute(['/absolute/path'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(mockFS.stat).toHaveBeenCalledWith('/absolute/path');
    expect(result.stdout).toContain('file1.txt');
  });
});