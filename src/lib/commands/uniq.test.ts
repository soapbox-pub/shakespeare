import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UniqCommand } from './uniq';
import type { JSRuntimeFS } from '../JSRuntime';

describe('UniqCommand', () => {
  const mockFS = {
    stat: vi.fn(),
    readFile: vi.fn(),
  } as unknown as JSRuntimeFS;

  const uniqCommand = new UniqCommand(mockFS);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should remove consecutive duplicate lines', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('apple\napple\nbanana\nbanana\nbanana\ncherry\n');

    const result = await uniqCommand.execute(['test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('apple\nbanana\ncherry\n');
    expect(result.stderr).toBe('');
  });

  it('should show count with -c option', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('apple\napple\nbanana\nbanana\nbanana\ncherry\n');

    const result = await uniqCommand.execute(['-c', 'test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('      2 apple\n      3 banana\n      1 cherry\n');
    expect(result.stderr).toBe('');
  });

  it('should show only duplicates with -d option', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('apple\napple\nbanana\nbanana\nbanana\ncherry\n');

    const result = await uniqCommand.execute(['-d', 'test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('apple\nbanana\n');
    expect(result.stderr).toBe('');
  });

  it('should show only unique lines with -u option', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('apple\napple\nbanana\nbanana\nbanana\ncherry\n');

    const result = await uniqCommand.execute(['-u', 'test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('cherry\n');
    expect(result.stderr).toBe('');
  });

  it('should combine count and duplicates options', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('apple\napple\nbanana\nbanana\nbanana\ncherry\n');

    const result = await uniqCommand.execute(['-cd', 'test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('      2 apple\n      3 banana\n');
    expect(result.stderr).toBe('');
  });

  it('should handle file with no duplicates', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('apple\nbanana\ncherry\n');

    const result = await uniqCommand.execute(['test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('apple\nbanana\ncherry\n');
    expect(result.stderr).toBe('');
  });

  it('should handle empty file', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('');

    const result = await uniqCommand.execute(['test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  it('should handle single line file', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('single line\n');

    const result = await uniqCommand.execute(['test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('single line\n');
    expect(result.stderr).toBe('');
  });

  it('should error for non-existent file', async () => {
    vi.mocked(mockFS.stat).mockRejectedValue(new Error('ENOENT: no such file'));

    const result = await uniqCommand.execute(['nonexistent.txt'], '/test');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('No such file or directory');
  });

  it('should error for directory', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => true, isFile: () => false });

    const result = await uniqCommand.execute(['directory'], '/test');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('Is a directory');
  });

  it('should reject absolute paths', async () => {
    const result = await uniqCommand.execute(['/absolute/path'], '/test');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('absolute paths are not supported');
  });

  it('should return empty output for no files', async () => {
    const result = await uniqCommand.execute([], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });
});