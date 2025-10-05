import { describe, it, expect, beforeEach } from 'vitest';
import { GitDiffCommand } from './diff';
import type { GitSubcommandOptions } from '../git';
import type { Git } from '../../git';
import type { JSRuntimeFS } from '../../JSRuntime';

// Mock implementations
const mockGit = {
  statusMatrix: async () => [
    // [filepath, headStatus, workdirStatus, stageStatus]
    ['modified.txt', 1, 2, 1], // Modified in working dir
    ['staged.txt', 1, 1, 2],   // Modified in stage
    ['new.txt', 0, 2, 0],      // Untracked file
    ['deleted.txt', 1, 0, 1],  // Deleted in working dir
  ],
  readBlob: async ({ filepath }: { filepath: string }) => {
    const content = {
      'modified.txt': 'original content\nline 2',
      'staged.txt': 'original staged content',
      'deleted.txt': 'deleted file content',
    }[filepath] || '';
    return { blob: new TextEncoder().encode(content) };
  },
  log: async () => [],
} as unknown as Git;

const mockFS = {
  stat: async (path: string) => {
    if (path.endsWith('/.git')) {
      return { isDirectory: () => true };
    }
    throw new Error('File not found');
  },
  readFile: async (path: string) => {
    const filename = path.split('/').pop();
    const content = {
      'modified.txt': 'modified content\nline 2\nnew line',
      'staged.txt': 'staged content modified',
      'new.txt': 'this is a new file',
      // deleted.txt is not in working dir
    }[filename || ''];

    if (!content) {
      throw new Error('File not found');
    }
    return content;
  },
} as unknown as JSRuntimeFS;

const mockOptions: GitSubcommandOptions = {
  git: mockGit,
  fs: mockFS,
  pwd: '/test/repo',
};

describe('GitDiffCommand', () => {
  let command: GitDiffCommand;

  beforeEach(() => {
    command = new GitDiffCommand(mockOptions);
  });

  describe('parseArgs', () => {
    type ParseArgsResult = {
      commits: string[];
      paths: string[];
      options: { cached: boolean; staged: boolean };
    };

    it('should parse no arguments correctly', () => {
      const result = (command as unknown as { parseArgs: (args: string[]) => ParseArgsResult }).parseArgs([]);
      expect(result).toEqual({
        commits: [],
        paths: [],
        options: { cached: false, staged: false },
      });
    });

    it('should parse --cached option', () => {
      const result = (command as unknown as { parseArgs: (args: string[]) => ParseArgsResult }).parseArgs(['--cached']);
      expect(result).toEqual({
        commits: [],
        paths: [],
        options: { cached: true, staged: true },
      });
    });

    it('should parse commits and paths', () => {
      const result = (command as unknown as { parseArgs: (args: string[]) => ParseArgsResult }).parseArgs(['HEAD~1', 'HEAD', '--', 'file.txt']);
      expect(result).toEqual({
        commits: ['HEAD~1', 'HEAD'],
        paths: ['file.txt'],
        options: { cached: false, staged: false },
      });
    });
  });

  describe('execute', () => {
    it('should fail when not in a git repository', async () => {
      const commandWithoutGit = new GitDiffCommand({
        ...mockOptions,
        fs: {
          stat: async () => {
            throw new Error('File not found');
          },
        } as unknown as JSRuntimeFS,
      });

      const result = await commandWithoutGit.execute([]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('fatal: not a git repository');
    });

    it('should show working directory diff for modified files', async () => {
      const result = await command.execute([]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('diff --git a/modified.txt b/modified.txt');
      expect(result.stdout).toContain('--- a/modified.txt');
      expect(result.stdout).toContain('+++ b/modified.txt');
      expect(result.stdout).toContain('-original content');
      expect(result.stdout).toContain('+modified content');
      expect(result.stdout).toContain('+new line');
    });

    it('should NOT show untracked files in diff', async () => {
      const result = await command.execute([]);

      expect(result.exitCode).toBe(0);
      // Untracked files should not appear in git diff output
      expect(result.stdout).not.toContain('diff --git a/new.txt b/new.txt');
      expect(result.stdout).not.toContain('new file mode 100644');
      expect(result.stdout).not.toContain('+this is a new file');
    });

    it('should show deleted files in diff', async () => {
      const result = await command.execute([]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('diff --git a/deleted.txt b/deleted.txt');
      expect(result.stdout).toContain('deleted file mode 100644');
      expect(result.stdout).toContain('--- a/deleted.txt');
      expect(result.stdout).toContain('+++ /dev/null');
      expect(result.stdout).toContain('-deleted file content');
    });

    it('should show staged diff with --cached option', async () => {
      const result = await command.execute(['--cached']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('diff --git a/staged.txt b/staged.txt');
      expect(result.stdout).toContain('--- a/staged.txt');
      expect(result.stdout).toContain('+++ b/staged.txt');
    });

    it('should show newly added files in staged diff', async () => {
      // Test with a file that was added to the index (new file staged)
      const commandWithStagedNew = new GitDiffCommand({
        ...mockOptions,
        git: {
          ...mockGit,
          statusMatrix: async () => [
            ['new-staged.txt', 0, 1, 2], // New file added to stage
          ],
        } as unknown as Git,
      });

      const result = await commandWithStagedNew.execute(['--cached']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('diff --git a/new-staged.txt b/new-staged.txt');
      expect(result.stdout).toContain('new file mode 100644');
      expect(result.stdout).toContain('--- /dev/null');
      expect(result.stdout).toContain('+++ b/new-staged.txt');
    });

    it('should return empty output when no changes', async () => {
      const commandWithNoChanges = new GitDiffCommand({
        ...mockOptions,
        git: {
          ...mockGit,
          statusMatrix: async () => [],
        } as unknown as Git,
      });

      const result = await commandWithNoChanges.execute([]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('should filter by path when specified', async () => {
      const result = await command.execute(['--', 'modified.txt']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('diff --git a/modified.txt b/modified.txt');
      expect(result.stdout).not.toContain('new.txt');
      expect(result.stdout).not.toContain('deleted.txt');
    });
  });
});