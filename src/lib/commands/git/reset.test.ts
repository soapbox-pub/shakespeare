import { describe, it, expect, beforeEach } from 'vitest';
import { GitResetCommand } from './reset';
import type { GitSubcommandOptions } from '../git';
import type { Git } from '../../git';
import type { JSRuntimeFS } from '../../JSRuntime';

// Mock implementations
const mockGit = {
  statusMatrix: async () => [
    // [filepath, headStatus, workdirStatus, stageStatus]
    ['staged.txt', 1, 1, 2],      // Modified in stage
    ['new-staged.txt', 0, 1, 2],  // New file staged
    ['modified.txt', 1, 2, 1],    // Modified in working dir (not staged)
    ['unchanged.txt', 1, 1, 1],   // No changes
  ],
  resetIndex: async ({ filepath }: { filepath: string }) => {
    // Mock successful reset
    return { filepath };
  },
  resolveRef: async ({ ref }: { ref: string }) => {
    const refs = {
      'HEAD': 'abc123def456',
      'HEAD~1': 'def456abc123',
    };
    if (refs[ref as keyof typeof refs]) {
      return refs[ref as keyof typeof refs];
    }
    throw new Error(`Unknown ref: ${ref}`);
  },
  readCommit: async () => ({
    oid: 'abc123def456',
    commit: {
      message: 'Test commit',
      author: { name: 'Test', email: 'test@example.com' },
    },
  }),
  writeRef: async () => {},
  checkout: async () => {},
  listFiles: async () => ['file1.txt', 'file2.txt', 'file3.txt'],
  currentBranch: async () => 'main',
  readBlob: async () => ({ blob: new Uint8Array([72, 101, 108, 108, 111]) }), // "Hello"
} as unknown as Git;

const mockFS = {
  stat: async (path: string) => {
    if (path.endsWith('/.git')) {
      return { isDirectory: () => true };
    }
    throw new Error('File not found');
  },
  writeFile: async () => {},
  mkdir: async () => {},
  unlink: async () => {},
} as unknown as JSRuntimeFS;

const mockOptions: GitSubcommandOptions = {
  git: mockGit,
  fs: mockFS,
};

describe('GitResetCommand', () => {
  let command: GitResetCommand;

  beforeEach(() => {
    command = new GitResetCommand(mockOptions);
  });

  describe('parseArgs', () => {
    type ParseArgsResult = {
      mode: 'soft' | 'mixed' | 'hard';
      target: string;
      files: string[];
      isFileReset: boolean;
    };

    it('should parse no arguments as file reset', () => {
      const result = (command as unknown as { parseArgs: (args: string[]) => ParseArgsResult }).parseArgs([]);
      expect(result).toEqual({
        mode: 'mixed',
        target: 'HEAD',
        files: [],
        isFileReset: true,
      });
    });

    it('should parse HEAD as file reset', () => {
      const result = (command as unknown as { parseArgs: (args: string[]) => ParseArgsResult }).parseArgs(['HEAD']);
      expect(result).toEqual({
        mode: 'mixed',
        target: 'HEAD',
        files: [],
        isFileReset: true,
      });
    });

    it('should parse HEAD with files as file reset', () => {
      const result = (command as unknown as { parseArgs: (args: string[]) => ParseArgsResult }).parseArgs(['HEAD', 'file1.txt', 'file2.txt']);
      expect(result).toEqual({
        mode: 'mixed',
        target: 'HEAD',
        files: ['file1.txt', 'file2.txt'],
        isFileReset: true,
      });
    });

    it('should parse commit hash as commit reset', () => {
      const result = (command as unknown as { parseArgs: (args: string[]) => ParseArgsResult }).parseArgs(['abc123def']);
      expect(result).toEqual({
        mode: 'mixed',
        target: 'abc123def',
        files: [],
        isFileReset: false,
      });
    });

    it('should parse mode flags correctly', () => {
      const result = (command as unknown as { parseArgs: (args: string[]) => ParseArgsResult }).parseArgs(['--hard', 'HEAD~1']);
      expect(result).toEqual({
        mode: 'hard',
        target: 'HEAD~1',
        files: [],
        isFileReset: false,
      });
    });

    it('should parse mixed mode with commit', () => {
      const result = (command as unknown as { parseArgs: (args: string[]) => ParseArgsResult }).parseArgs(['--mixed', 'HEAD~1']);
      expect(result).toEqual({
        mode: 'mixed',
        target: 'HEAD~1',
        files: [],
        isFileReset: false,
      });
    });
  });

  describe('execute', () => {
    it('should fail when not in a git repository', async () => {
      const commandWithoutGit = new GitResetCommand({
        ...mockOptions,
        fs: {
          stat: async () => {
            throw new Error('File not found');
          },
        } as unknown as JSRuntimeFS,
      });

      const result = await commandWithoutGit.execute([], '/test/repo');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('fatal: not a git repository');
    });

    it('should unstage all files when called without arguments', async () => {
      const result = await command.execute([], '/test/repo');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Unstaged changes after reset:');
      expect(result.stdout).toContain('M\tstaged.txt');
      expect(result.stdout).toContain('M\tnew-staged.txt');
      // Should not include files that aren't staged
      expect(result.stdout).not.toContain('modified.txt');
      expect(result.stdout).not.toContain('unchanged.txt');
    });

    it('should unstage all files when called with HEAD', async () => {
      const result = await command.execute(['HEAD'], '/test/repo');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Unstaged changes after reset:');
      expect(result.stdout).toContain('M\tstaged.txt');
      expect(result.stdout).toContain('M\tnew-staged.txt');
    });

    it('should unstage specific files when called with HEAD and file paths', async () => {
      const result = await command.execute(['HEAD', 'staged.txt'], '/test/repo');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Unstaged changes after reset:');
      expect(result.stdout).toContain('M\tstaged.txt');
      expect(result.stdout).not.toContain('new-staged.txt');
    });

    it('should return empty output when no files are staged', async () => {
      const commandWithNoStaged = new GitResetCommand({
        ...mockOptions,
        git: {
          ...mockGit,
          statusMatrix: async () => [
            ['modified.txt', 1, 2, 1], // Modified in working dir only
            ['unchanged.txt', 1, 1, 1], // No changes
          ],
        } as unknown as Git,
      });

      const result = await commandWithNoStaged.execute([], '/test/repo');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('should handle errors when resetting specific files', async () => {
      const commandWithError = new GitResetCommand({
        ...mockOptions,
        git: {
          ...mockGit,
          resetIndex: async ({ filepath }: { filepath: string }) => {
            if (filepath === 'nonexistent.txt') {
              throw new Error('File not found');
            }
            return { filepath };
          },
        } as unknown as Git,
      });

      const result = await commandWithError.execute(['HEAD', 'nonexistent.txt'], '/test/repo');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("error: pathspec 'nonexistent.txt' did not match any file(s) known to git");
    });

    it('should handle commit reset with hard mode', async () => {
      const result = await command.execute(['--hard', 'HEAD~1'], '/test/repo');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('HEAD is now at def456a');
    });

    it('should handle commit reset with mixed mode', async () => {
      const result = await command.execute(['--mixed', 'HEAD~1'], '/test/repo');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('HEAD is now at def456a');
    });

    it('should return error for soft reset (not implemented)', async () => {
      const result = await command.execute(['--soft', 'HEAD~1'], '/test/repo');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--soft reset is not implemented');
    });

    it('should handle invalid commit reference', async () => {
      const result = await command.execute(['abcdef12345'], '/test/repo');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("fatal: ambiguous argument 'abcdef12345'");
    });
  });
});