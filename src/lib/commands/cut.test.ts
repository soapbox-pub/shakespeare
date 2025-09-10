import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CutCommand } from './cut';
import type { JSRuntimeFS } from '../JSRuntime';

describe('CutCommand', () => {
  const mockFS = {
    stat: vi.fn(),
    readFile: vi.fn(),
  } as unknown as JSRuntimeFS;

  const cutCommand = new CutCommand(mockFS);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract characters by position', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('hello world\nfoo\n');

    const result = await cutCommand.execute(['-c', '1,3,5', 'test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hlo\nfo\n');
    expect(result.stderr).toBe('');
  });

  it('should extract character ranges', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('hello world\n');

    const result = await cutCommand.execute(['-c', '1-5', 'test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello\n');
    expect(result.stderr).toBe('');
  });

  it('should extract fields with default tab delimiter', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('name\tage\tcity\nJohn\t25\tNY\n');

    const result = await cutCommand.execute(['-f', '1,3', 'test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('name\tcity\nJohn\tNY\n');
    expect(result.stderr).toBe('');
  });

  it('should extract fields with custom delimiter', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('name,age,city\nJohn,25,NY\n');

    const result = await cutCommand.execute(['-f', '1,3', '-d', ',', 'test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('name,city\nJohn,NY\n');
    expect(result.stderr).toBe('');
  });

  it('should extract field ranges', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('a,b,c,d,e\n1,2,3,4,5\n');

    const result = await cutCommand.execute(['-f', '2-4', '-d', ',', 'test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('b,c,d\n2,3,4\n');
    expect(result.stderr).toBe('');
  });

  it('should handle combined character options', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('hello world\n');

    const result = await cutCommand.execute(['-c1,3,5-7', 'test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hlo w\n');
    expect(result.stderr).toBe('');
  });

  it('should handle combined field options', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('a,b,c,d,e\n');

    const result = await cutCommand.execute(['-f1,3-5', '-d,', 'test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('a,c,d,e\n');
    expect(result.stderr).toBe('');
  });

  it('should handle multiple files', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce('hello\n')
      .mockResolvedValueOnce('world\n');

    const result = await cutCommand.execute(['-c', '1-3', 'file1.txt', 'file2.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hel\nwor\n');
    expect(result.stderr).toBe('');
  });

  it('should error when no list specified', async () => {
    const result = await cutCommand.execute(['test.txt'], '/test');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('you must specify a list');
  });

  it('should error for non-existent file', async () => {
    vi.mocked(mockFS.stat).mockRejectedValue(new Error('ENOENT: no such file'));

    const result = await cutCommand.execute(['-c', '1', 'nonexistent.txt'], '/test');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('No such file or directory');
  });

  it('should error for directory', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => true, isFile: () => false });

    const result = await cutCommand.execute(['-c', '1', 'directory'], '/test');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('Is a directory');
  });

  it('should reject absolute paths', async () => {
    const result = await cutCommand.execute(['-c', '1', '/absolute/path'], '/test');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('absolute paths are not supported');
  });

  it('should return empty output for no files', async () => {
    const result = await cutCommand.execute(['-c', '1'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });
});