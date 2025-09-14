import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CatCommand } from './cat';
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

describe('CatCommand', () => {
  let mockFS: JSRuntimeFS;
  let catCommand: CatCommand;
  const testCwd = '/test/dir';

  beforeEach(() => {
    mockFS = createMockFS();
    catCommand = new CatCommand(mockFS);
  });

  it('should have correct command properties', () => {
    expect(catCommand.name).toBe('cat');
    expect(catCommand.description).toBe('Concatenate and display file contents');
    expect(catCommand.usage).toBe('cat [file...]');
  });

  it('should return error when no arguments provided', async () => {
    const result = await catCommand.execute([], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('missing file operand');
    expect(result.stdout).toBe('');
  });

  it('should read and return file content', async () => {
    const fileContent = 'Hello, World!';
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    vi.mocked(mockFS.readFile).mockResolvedValue(fileContent);

    const result = await catCommand.execute(['test.txt'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(fileContent);
    expect(result.stderr).toBe('');
    expect(mockFS.readFile).toHaveBeenCalledWith('/test/dir/test.txt', 'utf8');
  });

  it('should concatenate multiple files', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce('File 1 content\n')
      .mockResolvedValueOnce('File 2 content\n');

    const result = await catCommand.execute(['file1.txt', 'file2.txt'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('File 1 content\nFile 2 content\n');
    expect(result.stderr).toBe('');
  });

  it('should return error for directory', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    const result = await catCommand.execute(['somedir'], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Is a directory');
    expect(result.stdout).toBe('');
  });

  it('should return error for non-existent file', async () => {
    vi.mocked(mockFS.stat).mockRejectedValue(new Error('ENOENT: no such file or directory'));

    const result = await catCommand.execute(['nonexistent.txt'], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No such file or directory');
    expect(result.stdout).toBe('');
  });

  it('should handle absolute paths', async () => {
    const fileContent = 'Absolute path content';
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    vi.mocked(mockFS.readFile).mockResolvedValue(fileContent);

    const result = await catCommand.execute(['/absolute/path.txt'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(fileContent);
    expect(result.stderr).toBe('');
    expect(mockFS.readFile).toHaveBeenCalledWith('/absolute/path.txt', 'utf8');
  });

  it('should handle Windows-style absolute paths', async () => {
    const fileContent = 'Windows path content';
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    vi.mocked(mockFS.readFile).mockResolvedValue(fileContent);

    const result = await catCommand.execute(['C:\\temp\\file.txt'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(fileContent);
    expect(result.stderr).toBe('');
    expect(mockFS.readFile).toHaveBeenCalledWith('C:\\temp\\file.txt', 'utf8');
  });

  it('should handle permission errors', async () => {
    vi.mocked(mockFS.stat).mockRejectedValue(new Error('EACCES: permission denied'));

    const result = await catCommand.execute(['restricted.txt'], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Permission denied');
    expect(result.stdout).toBe('');
  });
});