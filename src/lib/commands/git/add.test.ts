import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitAddCommand } from './add';
import type { JSRuntimeFS } from '../../JSRuntime';
import type { Git } from '../../git';

// Mock filesystem
const createMockFS = (): JSRuntimeFS => ({
  readFile: vi.fn().mockResolvedValue('mock content'),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  mkdir: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockImplementation((path: string) => {
    if (path.endsWith('/.git')) {
      return Promise.resolve({
        isDirectory: () => true,
        isFile: () => false,
        size: 0,
        mtimeMs: Date.now(),
      });
    }
    return Promise.resolve({
      isDirectory: () => false,
      isFile: () => true,
      size: 100,
      mtimeMs: Date.now(),
    });
  }),
  lstat: vi.fn().mockResolvedValue({
    isDirectory: () => false,
    isFile: () => true,
    size: 100,
    mtimeMs: Date.now(),
  }),
  unlink: vi.fn().mockResolvedValue(undefined),
  rmdir: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  readlink: vi.fn().mockResolvedValue('mock link'),
  symlink: vi.fn().mockResolvedValue(undefined),
});

// Mock Git
const createMockGit = (): Git => ({
  statusMatrix: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
} as unknown as Git);

describe('GitAddCommand', () => {
  let addCommand: GitAddCommand;
  let mockFS: JSRuntimeFS;
  let mockGit: Git;
  const testCwd = '/test';

  beforeEach(() => {
    mockFS = createMockFS();
    mockGit = createMockGit();
    addCommand = new GitAddCommand({
      git: mockGit,
      fs: mockFS,
    });
  });

  it('should have correct command properties', () => {
    expect(addCommand.name).toBe('add');
    expect(addCommand.description).toBe('Add file contents to the index');
    expect(addCommand.usage).toBe('git add [--all | -A] [--] [<pathspec>...]');
  });

  it('should return error when not in a git repository', async () => {
    // Mock stat to throw error for .git directory
    vi.mocked(mockFS.stat).mockRejectedValueOnce(new Error('ENOENT'));

    const result = await addCommand.execute(['file.txt'], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('fatal: not a git repository');
  });

  it('should return error when no files specified', async () => {
    const result = await addCommand.execute([], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Nothing specified, nothing added');
    expect(result.stderr).toContain('Maybe you wanted to say \'git add .\'?');
  });

  it('should add all modified files with --all flag', async () => {
    // Mock status matrix with modified and untracked files
    // [filepath, headStatus, workdirStatus, stageStatus]
    vi.mocked(mockGit.statusMatrix).mockResolvedValue([
      ['modified.txt', 1, 2, 1],     // Modified file (not staged)
      ['untracked.txt', 0, 2, 0],    // Untracked file
      ['unchanged.txt', 1, 1, 1],    // Unchanged file
      ['staged.txt', 1, 2, 2],       // Already staged file
    ]);

    const result = await addCommand.execute(['--all'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(''); // Git add is silent on success

    // Should add modified and untracked files, but not unchanged or already staged
    expect(mockGit.add).toHaveBeenCalledWith({
      dir: testCwd,
      filepath: 'modified.txt',
    });
    expect(mockGit.add).toHaveBeenCalledWith({
      dir: testCwd,
      filepath: 'untracked.txt',
    });
    expect(mockGit.add).toHaveBeenCalledTimes(2);
  });

  it('should handle deleted files with --all flag', async () => {
    // Mock status matrix with deleted file
    vi.mocked(mockGit.statusMatrix).mockResolvedValue([
      ['deleted.txt', 1, 0, 1],      // Deleted file (not staged)
    ]);

    const result = await addCommand.execute(['--all'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');

    // Should remove the deleted file
    expect(mockGit.remove).toHaveBeenCalledWith({
      dir: testCwd,
      filepath: 'deleted.txt',
    });
    expect(mockGit.remove).toHaveBeenCalledTimes(1);
  });

  it('should add specific file', async () => {
    const result = await addCommand.execute(['file.txt'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');

    expect(mockGit.add).toHaveBeenCalledWith({
      dir: testCwd,
      filepath: 'file.txt',
    });
  });

  it('should handle git add . (current directory)', async () => {
    // Mock status matrix with various files
    vi.mocked(mockGit.statusMatrix).mockResolvedValue([
      ['file1.txt', 1, 2, 1],        // Modified file
      ['file2.txt', 0, 2, 0],        // Untracked file
      ['deleted.txt', 1, 0, 1],      // Deleted file
    ]);

    const result = await addCommand.execute(['.'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');

    // Should add modified and untracked files
    expect(mockGit.add).toHaveBeenCalledWith({
      dir: testCwd,
      filepath: 'file1.txt',
    });
    expect(mockGit.add).toHaveBeenCalledWith({
      dir: testCwd,
      filepath: 'file2.txt',
    });

    // Should remove deleted file
    expect(mockGit.remove).toHaveBeenCalledWith({
      dir: testCwd,
      filepath: 'deleted.txt',
    });
  });

  it('should reject absolute paths', async () => {
    const result = await addCommand.execute(['/absolute/path/file.txt'], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('absolute paths are not supported');
  });

  it('should handle non-existent files', async () => {
    // Mock stat to throw error for non-existent file
    vi.mocked(mockFS.stat).mockImplementation((path: string) => {
      if (path.endsWith('/.git')) {
        return Promise.resolve({
          isDirectory: () => true,
          isFile: () => false,
          size: 0,
          mtimeMs: Date.now(),
        });
      }
      if (path.includes('nonexistent')) {
        throw new Error('ENOENT');
      }
      return Promise.resolve({
        isDirectory: () => false,
        isFile: () => true,
        size: 100,
        mtimeMs: Date.now(),
      });
    });

    // Mock git.remove to also throw error (file doesn't exist in git either)
    vi.mocked(mockGit.remove).mockRejectedValueOnce(new Error('File not found'));

    const result = await addCommand.execute(['nonexistent.txt'], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('pathspec \'nonexistent.txt\' did not match any files');
  });

  it('should handle -A flag (same as --all)', async () => {
    vi.mocked(mockGit.statusMatrix).mockResolvedValue([
      ['modified.txt', 1, 2, 1],     // Modified file
    ]);

    const result = await addCommand.execute(['-A'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');

    expect(mockGit.add).toHaveBeenCalledWith({
      dir: testCwd,
      filepath: 'modified.txt',
    });
  });

  it('should handle mixed options and paths', async () => {
    // Mock status matrix for --all to work
    vi.mocked(mockGit.statusMatrix).mockResolvedValue([
      ['modified.txt', 1, 2, 1],     // Modified file
    ]);

    const result = await addCommand.execute(['--all', 'specific.txt'], testCwd);

    expect(result.exitCode).toBe(0);

    // When --all is specified, it should ignore specific paths and add all files
    expect(mockGit.statusMatrix).toHaveBeenCalled();
  });

  it('should handle double dash separator', async () => {
    const result = await addCommand.execute(['--', 'file.txt'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');

    expect(mockGit.add).toHaveBeenCalledWith({
      dir: testCwd,
      filepath: 'file.txt',
    });
  });

  it('should continue with other files if one fails', async () => {
    vi.mocked(mockGit.statusMatrix).mockResolvedValue([
      ['good.txt', 1, 2, 1],         // This should succeed
      ['bad.txt', 1, 2, 1],          // This will fail
    ]);

    // Mock git.add to fail for bad.txt but succeed for good.txt
    vi.mocked(mockGit.add).mockImplementation(({ filepath }) => {
      if (filepath === 'bad.txt') {
        throw new Error('Permission denied');
      }
      return Promise.resolve();
    });

    const result = await addCommand.execute(['--all'], testCwd);

    expect(result.exitCode).toBe(0); // Should still succeed overall
    expect(mockGit.add).toHaveBeenCalledTimes(2);
  });
});