import { describe, it, expect, beforeEach } from 'vitest';
import { GitPullCommand } from './pull';
import type { GitSubcommandOptions } from '../git';
import type { Git } from '../../git';
import type { JSRuntimeFS } from '../../JSRuntime';

// Mock implementations
const mockGit = {
  currentBranch: async () => 'main',
  listRemotes: async () => [{ remote: 'origin', url: 'https://github.com/user/repo.git' }],
  statusMatrix: async () => [],
  fetch: async () => {},
  resolveRef: async () => 'abc123',
  merge: async () => {},
} as unknown as Git;

const mockFS = {
  stat: async () => ({ isDirectory: () => true }),
} as unknown as JSRuntimeFS;

const mockOptions: GitSubcommandOptions = {
  git: mockGit,
  fs: mockFS,
};

describe('GitPullCommand', () => {
  let command: GitPullCommand;

  beforeEach(() => {
    command = new GitPullCommand(mockOptions);
  });

  describe('parseArgs', () => {
    it('should parse no arguments correctly', () => {
      // Access the private method for testing
      const result = (command as unknown as { parseArgs: (args: string[]) => { remote: string; branch?: string } }).parseArgs([]);
      expect(result).toEqual({
        remote: 'origin',
        branch: undefined,
      });
    });

    it('should parse remote only', () => {
      const result = (command as unknown as { parseArgs: (args: string[]) => { remote: string; branch?: string } }).parseArgs(['upstream']);
      expect(result).toEqual({
        remote: 'upstream',
        branch: undefined,
      });
    });

    it('should parse remote and branch correctly', () => {
      const result = (command as unknown as { parseArgs: (args: string[]) => { remote: string; branch?: string } }).parseArgs(['origin', 'main']);
      expect(result).toEqual({
        remote: 'origin',
        branch: 'main',
      });
    });

    it('should parse different remote and branch', () => {
      const result = (command as unknown as { parseArgs: (args: string[]) => { remote: string; branch?: string } }).parseArgs(['upstream', 'develop']);
      expect(result).toEqual({
        remote: 'upstream',
        branch: 'develop',
      });
    });

    it('should ignore option flags', () => {
      const result = (command as unknown as { parseArgs: (args: string[]) => { remote: string; branch?: string } }).parseArgs(['--rebase', 'origin', '--verbose', 'main']);
      expect(result).toEqual({
        remote: 'origin',
        branch: 'main',
      });
    });

    it('should handle extra arguments beyond remote and branch', () => {
      const result = (command as unknown as { parseArgs: (args: string[]) => { remote: string; branch?: string } }).parseArgs(['origin', 'main', 'extra', 'args']);
      expect(result).toEqual({
        remote: 'origin',
        branch: 'main',
      });
    });
  });

  describe('execute', () => {
    it('should list modified files when there are uncommitted changes', async () => {
      // Mock statusMatrix to return some modified files
      const mockGitWithChanges = {
        ...mockGit,
        statusMatrix: async () => [
          ['src/index.ts', 1, 2, 1], // Modified file
          ['README.md', 1, 2, 2],   // Modified and staged
          ['package.json', 0, 2, 0], // Untracked file
        ],
      } as unknown as Git;

      // Mock FS to ensure .git directory exists
      const mockFSWithGit = {
        stat: async (path: string) => {
          if (path.endsWith('/.git')) {
            return { isDirectory: () => true };
          }
          throw new Error('File not found');
        },
      } as unknown as JSRuntimeFS;

      const commandWithChanges = new GitPullCommand({
        git: mockGitWithChanges,
        fs: mockFSWithGit,
      });

      const result = await commandWithChanges.execute(['origin', 'main'], '/test/repo');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('error: Your local changes to the following files would be overwritten by merge:');
      expect(result.stderr).toContain('\tsrc/index.ts');
      expect(result.stderr).toContain('\tREADME.md');
      expect(result.stderr).toContain('\tpackage.json');
      expect(result.stderr).toContain('Please commit your changes or stash them before you merge.');
    });
  });
});