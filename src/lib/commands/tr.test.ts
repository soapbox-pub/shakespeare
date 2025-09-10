import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrCommand } from './tr';
import type { JSRuntimeFS } from '../JSRuntime';

describe('TrCommand', () => {
  const mockFS = {
    stat: vi.fn(),
    readFile: vi.fn(),
  } as unknown as JSRuntimeFS;

  const trCommand = new TrCommand(mockFS);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should translate characters', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('hello world');

    const result = await trCommand.execute(['aeiou', 'AEIOU', 'test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hEllO wOrld');
    expect(result.stderr).toBe('');
  });

  it('should translate character ranges', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('hello WORLD');

    const result = await trCommand.execute(['a-z', 'A-Z', 'test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('HELLO WORLD');
    expect(result.stderr).toBe('');
  });

  it('should delete characters with -d option', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('hello world!');

    const result = await trCommand.execute(['-d', 'aeiou', 'test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hll wrld!');
    expect(result.stderr).toBe('');
  });

  it('should delete character ranges', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('hello123world456');

    const result = await trCommand.execute(['-d', '0-9', 'test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('helloworld');
    expect(result.stderr).toBe('');
  });

  it('should handle shorter second set by repeating last character', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('abcdef');

    const result = await trCommand.execute(['a-f', 'XY', 'test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('XYYYYY');
    expect(result.stderr).toBe('');
  });

  it('should handle multiple files', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce('hello')
      .mockResolvedValueOnce(' world');

    const result = await trCommand.execute(['a-z', 'A-Z', 'file1.txt', 'file2.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('HELLO WORLD');
    expect(result.stderr).toBe('');
  });

  it('should handle single character sets', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('hello');

    const result = await trCommand.execute(['l', 'L', 'test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('heLLo');
    expect(result.stderr).toBe('');
  });

  it('should preserve characters not in translation set', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    vi.mocked(mockFS.readFile).mockResolvedValue('hello 123!');

    const result = await trCommand.execute(['a-z', 'A-Z', 'test.txt'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('HELLO 123!');
    expect(result.stderr).toBe('');
  });

  it('should error when no operands provided', async () => {
    const result = await trCommand.execute([], '/test');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('missing operand');
  });

  it('should error when second set missing in translate mode', async () => {
    const result = await trCommand.execute(['abc'], '/test');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('missing operand');
  });

  it('should error for non-existent file', async () => {
    vi.mocked(mockFS.stat).mockRejectedValue(new Error('ENOENT: no such file'));

    const result = await trCommand.execute(['a', 'A', 'nonexistent.txt'], '/test');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('No such file or directory');
  });

  it('should error for directory', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({ isDirectory: () => true, isFile: () => false });

    const result = await trCommand.execute(['a', 'A', 'directory'], '/test');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('Is a directory');
  });

  it('should reject absolute paths', async () => {
    const result = await trCommand.execute(['a', 'A', '/absolute/path'], '/test');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('absolute paths are not supported');
  });

  it('should return empty output for no files', async () => {
    const result = await trCommand.execute(['a', 'A'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });
});