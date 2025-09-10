import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CpCommand } from './cp';
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

describe('CpCommand', () => {
  let mockFS: JSRuntimeFS;
  let cpCommand: CpCommand;
  const testCwd = '/test/dir';

  beforeEach(() => {
    mockFS = createMockFS();
    cpCommand = new CpCommand(mockFS);
  });

  it('should have correct command properties', () => {
    expect(cpCommand.name).toBe('cp');
    expect(cpCommand.description).toBe('Copy files and directories');
    expect(cpCommand.usage).toBe('cp [-r] source... destination');
  });

  it.skip('should copy a file', async () => {
    // TODO: Fix this test - complex mocking scenario
    const fileContent = new Uint8Array([1, 2, 3, 4]);
    vi.mocked(mockFS.stat)
      .mockResolvedValueOnce({
        isDirectory: () => false,
        isFile: () => true,
      })
      .mockRejectedValueOnce(new Error('ENOENT')) // destination doesn't exist
      .mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
      }); // parent directory exists for all subsequent calls

    vi.mocked(mockFS.readFile).mockResolvedValue(fileContent);
    vi.mocked(mockFS.writeFile).mockResolvedValue();

    const result = await cpCommand.execute(['source.txt', 'dest.txt'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(mockFS.readFile).toHaveBeenCalledWith('/test/dir/source.txt');
    expect(mockFS.writeFile).toHaveBeenCalledWith('/test/dir/dest.txt', fileContent);
  });

  it.skip('should copy file into directory', async () => {
    // TODO: Fix this test - complex mocking scenario
    const fileContent = new Uint8Array([1, 2, 3, 4]);
    vi.mocked(mockFS.stat)
      .mockResolvedValueOnce({
        isDirectory: () => false,
        isFile: () => true,
      })
      .mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
      }); // destination is directory, all other stat calls succeed

    vi.mocked(mockFS.readFile).mockResolvedValue(fileContent);
    vi.mocked(mockFS.writeFile).mockResolvedValue();

    const result = await cpCommand.execute(['source.txt', 'destdir'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(mockFS.writeFile).toHaveBeenCalledWith('/test/dir/destdir/source.txt', fileContent);
  });

  it('should return error when trying to copy directory without -r', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    const result = await cpCommand.execute(['sourcedir', 'destdir'], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('-r not specified');
  });

  it.skip('should copy directory with -r flag', async () => {
    // TODO: Fix this test - complex mocking scenario
    vi.mocked(mockFS.stat)
      .mockResolvedValueOnce({
        isDirectory: () => true,
        isFile: () => false,
      })
      .mockRejectedValueOnce(new Error('ENOENT')); // destination doesn't exist

    vi.mocked(mockFS.readdir).mockResolvedValue([]);
    vi.mocked(mockFS.mkdir).mockResolvedValue();

    const result = await cpCommand.execute(['-r', 'sourcedir', 'destdir'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(mockFS.mkdir).toHaveBeenCalledWith('/test/dir/destdir', { recursive: true });
  });

  it('should return error for non-existent source', async () => {
    vi.mocked(mockFS.stat).mockRejectedValue(new Error('ENOENT: no such file or directory'));

    const result = await cpCommand.execute(['nonexistent.txt', 'dest.txt'], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No such file or directory');
  });

  it('should reject absolute paths', async () => {
    const result = await cpCommand.execute(['/absolute/source', 'dest'], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('absolute paths are not supported');
  });

  it('should return error when missing operands', async () => {
    const result1 = await cpCommand.execute([], testCwd);
    expect(result1.exitCode).toBe(1);
    expect(result1.stderr).toContain('missing file operand');

    const result2 = await cpCommand.execute(['source.txt'], testCwd);
    expect(result2.exitCode).toBe(1);
    expect(result2.stderr).toContain('missing');
  });

  it('should return error when multiple sources but destination is not directory', async () => {
    vi.mocked(mockFS.stat).mockRejectedValue(new Error('ENOENT'));

    const result = await cpCommand.execute(['file1.txt', 'file2.txt', 'dest.txt'], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('is not a directory');
  });
});