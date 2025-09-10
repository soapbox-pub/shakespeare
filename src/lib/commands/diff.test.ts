import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiffCommand } from './diff';
import type { JSRuntimeFS } from '../JSRuntime';

describe('DiffCommand', () => {
  const mockFS = {
    stat: vi.fn(),
    readFile: vi.fn(),
  } as unknown as JSRuntimeFS;

  const diffCommand = new DiffCommand(mockFS);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty output for identical files', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('hello\nworld\n');

    const result = await diffCommand.execute(['file1.txt', 'file2.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  it('should show differences in normal format', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce('hello\nworld\n')
      .mockResolvedValueOnce('hello\nplanet\n');

    const result = await diffCommand.execute(['file1.txt', 'file2.txt'], '/test');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('2c2');
    expect(result.stderr).toContain('< world');
    expect(result.stderr).toContain('> planet');
    expect(result.stdout).toBe('');
  });

  it('should show differences in unified format', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce('hello\nworld\n')
      .mockResolvedValueOnce('hello\nplanet\n');

    const result = await diffCommand.execute(['-u', 'file1.txt', 'file2.txt'], '/test');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--- file1.txt');
    expect(result.stderr).toContain('+++ file2.txt');
    expect(result.stderr).toContain('-world');
    expect(result.stderr).toContain('+planet');
    expect(result.stdout).toBe('');
  });

  it('should handle added lines', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce('hello\n')
      .mockResolvedValueOnce('hello\nworld\n');

    const result = await diffCommand.execute(['file1.txt', 'file2.txt'], '/test');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('a');
    expect(result.stderr).toContain('> world');
    expect(result.stdout).toBe('');
  });

  it('should handle deleted lines', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce('hello\nworld\n')
      .mockResolvedValueOnce('hello\n');

    const result = await diffCommand.execute(['file1.txt', 'file2.txt'], '/test');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('d');
    expect(result.stderr).toContain('< world');
    expect(result.stdout).toBe('');
  });

  it('should error when wrong number of arguments', async () => {
    const result = await diffCommand.execute(['file1.txt'], '/test');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('missing operand');
  });

  it('should error for non-existent file', async () => {
    vi.mocked(mockFS.stat).mockRejectedValue(new Error('ENOENT: no such file'));

    const result = await diffCommand.execute(['nonexistent1.txt', 'nonexistent2.txt'], '/test');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('No such file or directory');
  });

  it('should error for directory', async () => {
    vi.mocked(mockFS.stat)
      .mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false })
      .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true });

    const result = await diffCommand.execute(['directory', 'file.txt'], '/test');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('Is a directory');
  });

  it('should reject absolute paths', async () => {
    const result = await diffCommand.execute(['/absolute/path1', 'file2.txt'], '/test');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('absolute paths are not supported');
  });

  it('should handle empty files', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('');

    const result = await diffCommand.execute(['empty1.txt', 'empty2.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });
});