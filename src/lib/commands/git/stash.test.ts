import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitStashCommand } from './stash';
import type { JSRuntimeFS } from '../../JSRuntime';
import type { Git } from '../../git';

// Mock filesystem
const createMockFS = (): JSRuntimeFS => ({
  readFile: vi.fn().mockImplementation((path: string) => {
    if (path.includes('shakespeare_stash.json')) {
      return Promise.reject(new Error('ENOENT'));
    }
    return Promise.resolve('mock content');
  }),
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
  currentBranch: vi.fn().mockResolvedValue('main'),
  add: vi.fn(),
  checkout: vi.fn(),
  resetIndex: vi.fn(),
  readBlob: vi.fn().mockResolvedValue({ blob: new Uint8Array() }),
} as unknown as Git);

describe('GitStashCommand', () => {
  let stashCommand: GitStashCommand;
  let mockFS: JSRuntimeFS;
  let mockGit: Git;
  const testCwd = '/test';

  beforeEach(() => {
    mockFS = createMockFS();
    mockGit = createMockGit();
    stashCommand = new GitStashCommand({
      git: mockGit,
      fs: mockFS,
    });
  });

  it('should have correct command properties', () => {
    expect(stashCommand.name).toBe('stash');
    expect(stashCommand.description).toBe('Stash the changes in a dirty working directory away');
    expect(stashCommand.usage).toBe('git stash [push | list | apply | pop | drop | clear | show] [<options>]');
  });

  it('should return error when not in a git repository', async () => {
    vi.mocked(mockFS.stat).mockRejectedValueOnce(new Error('ENOENT'));

    const result = await stashCommand.execute(['push'], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('fatal: not a git repository');
  });

  it('should show help with --help flag', async () => {
    const result = await stashCommand.execute(['--help'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('git stash list');
    expect(result.stdout).toContain('git stash push');
    expect(result.stdout).toContain('pop | apply');
  });

  describe('stash push', () => {
    it('should return error when no changes to stash', async () => {
      vi.mocked(mockGit.statusMatrix).mockResolvedValue([
        ['unchanged.txt', 1, 1, 1], // No changes
      ]);

      const result = await stashCommand.execute(['push'], testCwd);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No local changes to save');
    });

    it('should stash modified files', async () => {
      vi.mocked(mockGit.statusMatrix).mockResolvedValue([
        ['modified.txt', 1, 2, 2], // Staged modified file
      ]);
      vi.mocked(mockFS.readFile).mockImplementation((path: string) => {
        if (path.includes('modified.txt')) {
          return Promise.resolve('modified content');
        }
        if (path.includes('shakespeare_stash.json')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve('');
      });

      const result = await stashCommand.execute(['push'], testCwd);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Saved working directory and index state');
      expect(mockFS.writeFile).toHaveBeenCalled();
      expect(mockGit.checkout).toHaveBeenCalledWith({
        dir: testCwd,
        filepaths: ['modified.txt'],
        force: true,
      });
    });

    it('should stash with custom message', async () => {
      vi.mocked(mockGit.statusMatrix).mockResolvedValue([
        ['modified.txt', 1, 2, 2],
      ]);
      vi.mocked(mockFS.readFile).mockImplementation((path: string) => {
        if (path.includes('modified.txt')) {
          return Promise.resolve('content');
        }
        if (path.includes('shakespeare_stash.json')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve('');
      });

      const result = await stashCommand.execute(['push', '-m', 'my custom message'], testCwd);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('my custom message');
    });

    it('should include untracked files with -u flag', async () => {
      vi.mocked(mockGit.statusMatrix).mockResolvedValue([
        ['untracked.txt', 0, 2, 0], // Untracked file
      ]);
      vi.mocked(mockFS.readFile).mockImplementation((path: string) => {
        if (path.includes('untracked.txt')) {
          return Promise.resolve('untracked content');
        }
        if (path.includes('shakespeare_stash.json')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve('');
      });

      const result = await stashCommand.execute(['push', '-u'], testCwd);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Saved working directory');
      expect(mockFS.unlink).toHaveBeenCalledWith(expect.stringContaining('untracked.txt'));
    });

    it('should handle deleted files', async () => {
      vi.mocked(mockGit.statusMatrix).mockResolvedValue([
        ['deleted.txt', 1, 0, 1], // Deleted file
      ]);
      vi.mocked(mockFS.readFile).mockImplementation((path: string) => {
        if (path.includes('shakespeare_stash.json')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve('');
      });

      const result = await stashCommand.execute(['push'], testCwd);

      expect(result.exitCode).toBe(0);
      expect(mockGit.checkout).toHaveBeenCalledWith({
        dir: testCwd,
        filepaths: ['deleted.txt'],
        force: true,
      });
    });

    it('should clear staging area after stash', async () => {
      vi.mocked(mockGit.statusMatrix).mockResolvedValue([
        ['staged.txt', 1, 2, 2], // Staged file
      ]);
      vi.mocked(mockFS.readFile).mockImplementation((path: string) => {
        if (path.includes('staged.txt')) {
          return Promise.resolve('staged content');
        }
        if (path.includes('shakespeare_stash.json')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve('');
      });

      const result = await stashCommand.execute(['push'], testCwd);

      expect(result.exitCode).toBe(0);
      expect(mockGit.resetIndex).toHaveBeenCalledWith({
        dir: testCwd,
        filepath: 'staged.txt',
      });
    });
  });

  describe('stash list', () => {
    it('should return empty when no stashes', async () => {
      vi.mocked(mockFS.readFile).mockRejectedValue(new Error('ENOENT'));

      const result = await stashCommand.execute(['list'], testCwd);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('should list all stashes', async () => {
      const mockStashes = [
        { message: 'first stash', branch: 'main', timestamp: Date.now(), files: [], stagedFiles: [] },
        { message: 'second stash', branch: 'main', timestamp: Date.now(), files: [], stagedFiles: [] },
      ];
      vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(mockStashes));

      const result = await stashCommand.execute(['list'], testCwd);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('stash@{0}: first stash');
      expect(result.stdout).toContain('stash@{1}: second stash');
    });
  });

  describe('stash show', () => {
    it('should return error when no stashes', async () => {
      vi.mocked(mockFS.readFile).mockRejectedValue(new Error('ENOENT'));

      const result = await stashCommand.execute(['show'], testCwd);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No stash entries found');
    });

    it('should show files in most recent stash', async () => {
      const mockStashes = [
        {
          message: 'test stash',
          branch: 'main',
          timestamp: Date.now(),
          files: [
            { filepath: 'modified.txt', content: 'content', status: 'modified' },
            { filepath: 'added.txt', content: 'content', status: 'added' },
          ],
          stagedFiles: [],
        },
      ];
      vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(mockStashes));

      const result = await stashCommand.execute(['show'], testCwd);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('M\tmodified.txt');
      expect(result.stdout).toContain('A\tadded.txt');
    });

    it('should show specific stash by index', async () => {
      const mockStashes = [
        {
          message: 'stash 0',
          branch: 'main',
          timestamp: Date.now(),
          files: [{ filepath: 'file0.txt', content: '', status: 'modified' }],
          stagedFiles: [],
        },
        {
          message: 'stash 1',
          branch: 'main',
          timestamp: Date.now(),
          files: [{ filepath: 'file1.txt', content: '', status: 'modified' }],
          stagedFiles: [],
        },
      ];
      vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(mockStashes));

      const result = await stashCommand.execute(['show', 'stash@{1}'], testCwd);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('file1.txt');
      expect(result.stdout).not.toContain('file0.txt');
    });
  });

  describe('stash apply', () => {
    it('should return error when no stashes', async () => {
      vi.mocked(mockFS.readFile).mockRejectedValue(new Error('ENOENT'));

      const result = await stashCommand.execute(['apply'], testCwd);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No stash entries found');
    });

    it('should apply most recent stash', async () => {
      const mockStashes = [
        {
          message: 'test stash',
          branch: 'main',
          timestamp: Date.now(),
          files: [
            { filepath: 'modified.txt', content: 'stashed content', status: 'modified' },
          ],
          stagedFiles: ['modified.txt'],
        },
      ];
      vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(mockStashes));

      const result = await stashCommand.execute(['apply'], testCwd);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('test stash');
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('modified.txt'),
        'stashed content'
      );
      expect(mockGit.add).toHaveBeenCalledWith({
        dir: testCwd,
        filepath: 'modified.txt',
      });
    });

    it('should apply specific stash by index', async () => {
      const mockStashes = [
        {
          message: 'stash 0',
          branch: 'main',
          timestamp: Date.now(),
          files: [{ filepath: 'file0.txt', content: 'content0', status: 'modified' }],
          stagedFiles: [],
        },
        {
          message: 'stash 1',
          branch: 'main',
          timestamp: Date.now(),
          files: [{ filepath: 'file1.txt', content: 'content1', status: 'modified' }],
          stagedFiles: [],
        },
      ];
      vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(mockStashes));

      const result = await stashCommand.execute(['apply', 'stash@{1}'], testCwd);

      expect(result.exitCode).toBe(0);
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('file1.txt'),
        'content1'
      );
    });

    it('should handle deleted files in stash', async () => {
      const mockStashes = [
        {
          message: 'deleted file',
          branch: 'main',
          timestamp: Date.now(),
          files: [{ filepath: 'deleted.txt', content: '', status: 'deleted' }],
          stagedFiles: [],
        },
      ];
      vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(mockStashes));

      const result = await stashCommand.execute(['apply'], testCwd);

      expect(result.exitCode).toBe(0);
      expect(mockFS.unlink).toHaveBeenCalledWith(expect.stringContaining('deleted.txt'));
    });
  });

  describe('stash pop', () => {
    it('should apply and drop stash', async () => {
      const mockStashes = [
        {
          message: 'test stash',
          branch: 'main',
          timestamp: Date.now(),
          files: [{ filepath: 'file.txt', content: 'content', status: 'modified' }],
          stagedFiles: [],
        },
      ];
      vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(mockStashes));

      const result = await stashCommand.execute(['pop'], testCwd);

      expect(result.exitCode).toBe(0);
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('file.txt'),
        'content'
      );
      // Should also write the stash file with empty array (dropped)
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('shakespeare_stash.json'),
        expect.stringContaining('[]')
      );
    });
  });

  describe('stash drop', () => {
    it('should return error when no stashes', async () => {
      vi.mocked(mockFS.readFile).mockRejectedValue(new Error('ENOENT'));

      const result = await stashCommand.execute(['drop'], testCwd);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No stash entries found');
    });

    it('should drop most recent stash', async () => {
      const mockStashes = [
        { message: 'stash 0', branch: 'main', timestamp: Date.now(), files: [], stagedFiles: [] },
        { message: 'stash 1', branch: 'main', timestamp: Date.now(), files: [], stagedFiles: [] },
      ];
      vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(mockStashes));

      const result = await stashCommand.execute(['drop'], testCwd);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Dropped stash@{0}');
      // Should write remaining stash
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('shakespeare_stash.json'),
        expect.stringMatching(/stash 1/)
      );
    });

    it('should drop specific stash by index', async () => {
      const mockStashes = [
        { message: 'stash 0', branch: 'main', timestamp: Date.now(), files: [], stagedFiles: [] },
        { message: 'stash 1', branch: 'main', timestamp: Date.now(), files: [], stagedFiles: [] },
      ];
      vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(mockStashes));

      const result = await stashCommand.execute(['drop', 'stash@{1}'], testCwd);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Dropped stash@{1}');
    });

    it('should return error for invalid stash index', async () => {
      const mockStashes = [
        { message: 'stash 0', branch: 'main', timestamp: Date.now(), files: [], stagedFiles: [] },
      ];
      vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(mockStashes));

      const result = await stashCommand.execute(['drop', 'stash@{5}'], testCwd);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('is not a valid reference');
    });
  });

  describe('stash clear', () => {
    it('should clear all stashes', async () => {
      const mockStashes = [
        { message: 'stash 0', branch: 'main', timestamp: Date.now(), files: [], stagedFiles: [] },
        { message: 'stash 1', branch: 'main', timestamp: Date.now(), files: [], stagedFiles: [] },
      ];
      vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(mockStashes));

      const result = await stashCommand.execute(['clear'], testCwd);

      expect(result.exitCode).toBe(0);
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('shakespeare_stash.json'),
        '[]'
      );
    });
  });

  describe('command aliases', () => {
    it('should accept "save" as alias for "push"', async () => {
      vi.mocked(mockGit.statusMatrix).mockResolvedValue([
        ['file.txt', 1, 2, 2],
      ]);
      vi.mocked(mockFS.readFile).mockImplementation((path: string) => {
        if (path.includes('file.txt')) {
          return Promise.resolve('content');
        }
        if (path.includes('shakespeare_stash.json')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve('');
      });

      const result = await stashCommand.execute(['save'], testCwd);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Saved working directory');
    });

    it('should default to "push" when no subcommand given', async () => {
      vi.mocked(mockGit.statusMatrix).mockResolvedValue([
        ['file.txt', 1, 2, 2],
      ]);
      vi.mocked(mockFS.readFile).mockImplementation((path: string) => {
        if (path.includes('file.txt')) {
          return Promise.resolve('content');
        }
        if (path.includes('shakespeare_stash.json')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve('');
      });

      const result = await stashCommand.execute([], testCwd);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Saved working directory');
    });
  });
});
