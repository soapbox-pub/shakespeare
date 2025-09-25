import { describe, it, expect, beforeEach, vi } from 'vitest';
import JSZip from 'jszip';
import { UnzipCommand } from './unzip';
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

describe('UnzipCommand', () => {
  let mockFS: JSRuntimeFS;
  let command: UnzipCommand;

  beforeEach(() => {
    mockFS = createMockFS();
    command = new UnzipCommand(mockFS);
  });

  const createTestZip = async (files: Record<string, string | Uint8Array>): Promise<Uint8Array> => {
    const zip = new JSZip();

    for (const [path, content] of Object.entries(files)) {
      if (path.endsWith('/')) {
        zip.folder(path.slice(0, -1));
      } else {
        zip.file(path, content);
      }
    }

    return zip.generateAsync({ type: 'uint8array' });
  };

  it('should show usage when no arguments provided', async () => {
    const result = await command.execute([], '/home');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('missing archive operand');
    expect(result.stderr).toContain('Usage:');
  });

  it('should show error for invalid options', async () => {
    const result = await command.execute(['-x', 'test.zip'], '/home');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("invalid option '-x'");
  });

  it('should show error for non-existent archive', async () => {
    vi.mocked(mockFS.stat).mockRejectedValue(new Error('ENOENT: no such file or directory'));

    const result = await command.execute(['nonexistent.zip'], '/home');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No such file or directory');
  });

  it('should show error when trying to unzip a directory', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    const result = await command.execute(['testdir'], '/home');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Is a directory');
  });

  it('should list archive contents with -l option', async () => {
    const zipData = await createTestZip({
      'file1.txt': 'Hello World',
      'dir1/': '',
      'dir1/file2.txt': 'Test content'
    });

    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    vi.mocked(mockFS.readFile).mockResolvedValue(zipData);

    const result = await command.execute(['-l', 'test.zip'], '/home');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Archive: test.zip');
    expect(result.stdout).toContain('file1.txt');
    expect(result.stdout).toContain('dir1/');
    expect(result.stdout).toContain('dir1/file2.txt');
  });

  it('should extract files to current directory', async () => {
    const zipData = await createTestZip({
      'file1.txt': 'Hello World'
    });

    // Mock file operations - keep it simple
    vi.mocked(mockFS.stat)
      .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true }) // archive exists
      .mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false }) // extraction dir exists
      .mockRejectedValue(new Error('ENOENT')); // files don't exist (for overwrite check)

    vi.mocked(mockFS.readFile).mockResolvedValue(zipData);
    vi.mocked(mockFS.writeFile).mockResolvedValue(undefined);

    const result = await command.execute(['test.zip'], '/home');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Archive: test.zip');
    expect(result.stdout).toContain('inflating: file1.txt');

    // Verify writeFile was called for extracted files
    expect(mockFS.writeFile).toHaveBeenCalledWith('/home/file1.txt', expect.any(Uint8Array));
  });

  it('should handle command line options correctly', async () => {
    const zipData = await createTestZip({
      'file1.txt': 'Hello World'
    });

    // Test -d option
    vi.mocked(mockFS.stat)
      .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true }) // archive exists
      .mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false }) // extraction dir exists
      .mockRejectedValue(new Error('ENOENT')); // files don't exist (for overwrite check)

    vi.mocked(mockFS.readFile).mockResolvedValue(zipData);
    vi.mocked(mockFS.writeFile).mockResolvedValue(undefined);

    const result = await command.execute(['-d', 'extract', 'test.zip'], '/home');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('inflating: file1.txt');
    expect(mockFS.writeFile).toHaveBeenCalledWith('/home/extract/file1.txt', expect.any(Uint8Array));
  });

  it('should handle overwrite option', async () => {
    const zipData = await createTestZip({
      'file1.txt': 'New content'
    });

    // Mock file exists scenario
    vi.mocked(mockFS.stat)
      .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true }) // archive exists
      .mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false }) // extraction dir exists
      .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true }); // file exists

    vi.mocked(mockFS.readFile).mockResolvedValue(zipData);
    vi.mocked(mockFS.writeFile).mockResolvedValue(undefined);

    // Without -o option, should fail
    const resultWithoutOverwrite = await command.execute(['test.zip'], '/home');
    expect(resultWithoutOverwrite.exitCode).toBe(1);
    expect(resultWithoutOverwrite.stderr).toContain('File exists (use -o to overwrite)');

    // Reset mocks
    vi.clearAllMocks();
    vi.mocked(mockFS.stat)
      .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true }) // archive exists
      .mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false }) // extraction dir exists
      .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true }); // file exists

    vi.mocked(mockFS.readFile).mockResolvedValue(zipData);
    vi.mocked(mockFS.writeFile).mockResolvedValue(undefined);

    // With -o option, should succeed
    const resultWithOverwrite = await command.execute(['-o', 'test.zip'], '/home');
    expect(resultWithOverwrite.exitCode).toBe(0);
    expect(resultWithOverwrite.stdout).toContain('inflating: file1.txt');
  });

  it('should prevent extraction outside allowed directories', async () => {
    // Since JSZip normalizes paths during creation, we'll test the security logic
    // by mocking the internal zip.files object to simulate a malicious ZIP
    const zipData = await createTestZip({
      'normal.txt': 'safe content'
    });

    // Mock the zip loading to return a ZIP with malicious paths
    const originalLoadAsync = JSZip.loadAsync;
    vi.spyOn(JSZip, 'loadAsync').mockImplementation(async () => {
      const zip = new JSZip();
      // Simulate malicious ZIP file entries that would escape the directory
      (zip as unknown as { files: Record<string, { name: string; dir: boolean; async: () => Promise<Uint8Array> }> }).files = {
        '../../../etc/passwd': {
          name: '../../../etc/passwd',
          dir: false,
          async: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
        },
        '../../outside.txt': {
          name: '../../outside.txt',
          dir: false,
          async: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
        },
        'normal.txt': {
          name: 'normal.txt',
          dir: false,
          async: vi.fn().mockResolvedValue(new Uint8Array([7, 8, 9])),
        }
      };
      return zip;
    });

    vi.mocked(mockFS.stat)
      .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true }) // archive exists
      .mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false }) // extraction dir exists
      .mockRejectedValue(new Error('ENOENT')); // files don't exist (for overwrite check)

    vi.mocked(mockFS.readFile).mockResolvedValue(zipData);
    vi.mocked(mockFS.writeFile).mockResolvedValue(undefined);

    const result = await command.execute(['test.zip'], '/home/user');

    // Should return error because some files were skipped
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Path is outside allowed directories');
    expect(result.stderr).toContain('../../../etc/passwd');
    expect(result.stderr).toContain('../../outside.txt');

    // Should only extract the safe file
    expect(mockFS.writeFile).toHaveBeenCalledWith('/home/user/normal.txt', expect.any(Uint8Array));
    expect(mockFS.writeFile).toHaveBeenCalledTimes(1);

    // Restore the original method
    JSZip.loadAsync = originalLoadAsync;
  });

  it('should allow extraction to /tmp directory', async () => {
    const zipData = await createTestZip({
      'file1.txt': 'Hello World'
    });

    vi.mocked(mockFS.stat)
      .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true }) // archive exists
      .mockRejectedValueOnce(new Error('ENOENT')) // extraction dir doesn't exist
      .mockRejectedValue(new Error('ENOENT')); // files don't exist (for overwrite check)

    vi.mocked(mockFS.readFile).mockResolvedValue(zipData);
    vi.mocked(mockFS.writeFile).mockResolvedValue(undefined);
    vi.mocked(mockFS.mkdir).mockResolvedValue(undefined);

    const result = await command.execute(['-d', '/tmp', 'test.zip'], '/home/user');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('inflating: file1.txt');
    expect(mockFS.writeFile).toHaveBeenCalledWith('/tmp/file1.txt', expect.any(Uint8Array));
  });

  it('should reject extraction directory outside allowed paths', async () => {
    const zipData = await createTestZip({
      'file1.txt': 'Hello World'
    });

    // Mock that the archive exists and provide zip data
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    vi.mocked(mockFS.readFile).mockResolvedValue(zipData);

    const result = await command.execute(['-d', '/etc', 'test.zip'], '/home/user');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("extraction directory '/etc' is outside allowed paths");
  });

  it('should support quiet mode with -q flag', async () => {
    const zipData = await createTestZip({
      'file1.txt': 'Hello World',
      'dir1/': '',
      'dir1/file2.txt': 'Test content'
    });

    vi.mocked(mockFS.stat)
      .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true }) // archive exists
      .mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false }) // extraction dir exists
      .mockRejectedValue(new Error('ENOENT')); // files don't exist (for overwrite check)

    vi.mocked(mockFS.readFile).mockResolvedValue(zipData);
    vi.mocked(mockFS.writeFile).mockResolvedValue(undefined);
    vi.mocked(mockFS.mkdir).mockResolvedValue(undefined);

    const result = await command.execute(['-q', 'test.zip'], '/home');

    expect(result.exitCode).toBe(0);
    // In quiet mode, should not show archive header or extraction messages
    expect(result.stdout).toBe('');

    // But files should still be extracted
    expect(mockFS.writeFile).toHaveBeenCalledWith('/home/file1.txt', expect.any(Uint8Array));
    expect(mockFS.writeFile).toHaveBeenCalledWith('/home/dir1/file2.txt', expect.any(Uint8Array));
  });
});