import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SortCommand } from './sort';
import type { JSRuntimeFS } from '../JSRuntime';

describe('SortCommand', () => {
  const mockFS = {
    stat: vi.fn(),
    readFile: vi.fn(),
  } as unknown as JSRuntimeFS;

  const sortCommand = new SortCommand(mockFS);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should sort lines alphabetically', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('zebra\napple\nbanana\n');

    const result = await sortCommand.execute(['test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('apple\nbanana\nzebra\n');
    expect(result.stderr).toBe('');
  });

  it('should sort lines in reverse order', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('apple\nbanana\nzebra\n');

    const result = await sortCommand.execute(['-r', 'test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('zebra\nbanana\napple\n');
    expect(result.stderr).toBe('');
  });

  it('should sort numerically', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('10\n2\n1\n20\n');

    const result = await sortCommand.execute(['-n', 'test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('1\n2\n10\n20\n');
    expect(result.stderr).toBe('');
  });

  it('should remove duplicates when unique flag is used', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('apple\nbanana\napple\nzebra\nbanana\n');

    const result = await sortCommand.execute(['-u', 'test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('apple\nbanana\nzebra\n');
    expect(result.stderr).toBe('');
  });

  it('should combine options', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('10\n2\n10\n1\n20\n2\n');

    const result = await sortCommand.execute(['-rnu', 'test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('20\n10\n2\n1\n');
    expect(result.stderr).toBe('');
  });

  it('should handle multiple files', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce('zebra\napple\n')
      .mockResolvedValueOnce('banana\ngrape\n');

    const result = await sortCommand.execute(['file1.txt', 'file2.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('apple\nbanana\ngrape\nzebra\n');
    expect(result.stderr).toBe('');
  });

  it('should error for non-existent file', async () => {
    vi.mocked(mockFS.stat).mockRejectedValue(new Error('ENOENT: no such file'));

    const result = await sortCommand.execute(['nonexistent.txt'], '/test');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('No such file or directory');
  });

  it('should error for directory', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => true, isFile: () => false });

    const result = await sortCommand.execute(['directory'], '/test');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('Is a directory');
  });

  it('should reject absolute paths', async () => {
    const result = await sortCommand.execute(['/absolute/path'], '/test');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('absolute paths are not supported');
  });

  it('should return empty output for no files', async () => {
    const result = await sortCommand.execute([], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });
});