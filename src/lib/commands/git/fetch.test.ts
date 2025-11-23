import { describe, it, expect, beforeEach } from 'vitest';
import { GitFetchCommand } from './fetch';
import type { GitSubcommandOptions } from '../git';
import type { Git } from '../../git';
import type { JSRuntimeFS } from '../../JSRuntime';

// Mock implementations
const mockGit = {
  listRemotes: async () => [
    { remote: 'origin', url: 'https://github.com/user/repo.git' },
    { remote: 'upstream', url: 'https://github.com/upstream/repo.git' }
  ],
  fetch: async () => {},
  resolveRef: async () => 'abc123def456',
} as unknown as Git;

const mockFS = {
  stat: async (path: string) => {
    if (path.endsWith('/.git')) {
      return { isDirectory: () => true };
    }
    throw new Error('File not found');
  },
} as unknown as JSRuntimeFS;

const mockOptions: GitSubcommandOptions = {
  git: mockGit,
  fs: mockFS,
};

describe('GitFetchCommand', () => {
  let command: GitFetchCommand;

  beforeEach(() => {
    command = new GitFetchCommand(mockOptions);
  });

  describe('parseArgs', () => {
    type ParseArgsResult = {
      remote: string;
      refs: string[];
      options: {
        all: boolean;
        tags: boolean;
        prune: boolean;
        verbose: boolean;
      };
    };

    it('should parse no arguments correctly', () => {
      const result = (command as unknown as { parseArgs: (args: string[]) => ParseArgsResult }).parseArgs([]);
      expect(result).toEqual({
        remote: 'origin',
        refs: [],
        options: {
          all: false,
          tags: false,
          prune: false,
          verbose: false,
        },
      });
    });

    it('should parse remote only', () => {
      const result = (command as unknown as { parseArgs: (args: string[]) => ParseArgsResult }).parseArgs(['upstream']);
      expect(result).toEqual({
        remote: 'upstream',
        refs: [],
        options: {
          all: false,
          tags: false,
          prune: false,
          verbose: false,
        },
      });
    });

    it('should parse remote and refs', () => {
      const result = (command as unknown as { parseArgs: (args: string[]) => ParseArgsResult }).parseArgs(['origin', 'main', 'develop']);
      expect(result).toEqual({
        remote: 'origin',
        refs: ['main', 'develop'],
        options: {
          all: false,
          tags: false,
          prune: false,
          verbose: false,
        },
      });
    });

    it('should parse options correctly', () => {
      const result = (command as unknown as { parseArgs: (args: string[]) => ParseArgsResult }).parseArgs(['--all', '--tags', '--prune', '--verbose']);
      expect(result).toEqual({
        remote: 'origin',
        refs: [],
        options: {
          all: true,
          tags: true,
          prune: true,
          verbose: true,
        },
      });
    });

    it('should parse short options', () => {
      const result = (command as unknown as { parseArgs: (args: string[]) => ParseArgsResult }).parseArgs(['-p', '-v']);
      expect(result).toEqual({
        remote: 'origin',
        refs: [],
        options: {
          all: false,
          tags: false,
          prune: true,
          verbose: true,
        },
      });
    });

    it('should parse mixed arguments and options', () => {
      const result = (command as unknown as { parseArgs: (args: string[]) => ParseArgsResult }).parseArgs(['upstream', '--verbose', 'main', '--tags']);
      expect(result).toEqual({
        remote: 'upstream',
        refs: ['main'],
        options: {
          all: false,
          tags: true,
          prune: false,
          verbose: true,
        },
      });
    });
  });

  describe('execute', () => {
    it('should fail when not in a git repository', async () => {
      const commandWithoutGit = new GitFetchCommand({
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

    it('should fail when remote does not exist', async () => {
      const result = await command.execute(['nonexistent'], '/test/repo');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("fatal: 'nonexistent' does not appear to be a git repository");
    });

    it('should fetch from default remote successfully', async () => {
      const result = await command.execute([], '/test/repo');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('From https://github.com/user/repo.git');
      expect(result.stdout).toContain('refs/heads/* -> refs/remotes/origin/*');
    });

    it('should fetch from specific remote successfully', async () => {
      const result = await command.execute(['upstream'], '/test/repo');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('From https://github.com/upstream/repo.git');
      expect(result.stdout).toContain('refs/heads/* -> refs/remotes/upstream/*');
    });

    it('should fetch specific refs successfully', async () => {
      const result = await command.execute(['origin', 'main'], '/test/repo');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('From https://github.com/user/repo.git');
      expect(result.stdout).toContain('* branch            main     -> origin/main');
    });

    it('should fetch multiple specific refs successfully', async () => {
      const result = await command.execute(['origin', 'main', 'develop'], '/test/repo');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('From https://github.com/user/repo.git');
      expect(result.stdout).toContain('* branch            main     -> origin/main');
      expect(result.stdout).toContain('* branch            develop     -> origin/develop');
    });

    it('should handle authentication errors', async () => {
      const commandWithAuthError = new GitFetchCommand({
        ...mockOptions,
        git: {
          ...mockGit,
          fetch: async () => {
            throw new Error('authentication failed');
          },
        } as unknown as Git,
      });

      const result = await commandWithAuthError.execute([], '/test/repo');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('fatal: Authentication failed');
    });

    it('should handle network errors', async () => {
      const commandWithNetworkError = new GitFetchCommand({
        ...mockOptions,
        git: {
          ...mockGit,
          fetch: async () => {
            throw new Error('network error');
          },
        } as unknown as Git,
      });

      const result = await commandWithNetworkError.execute([], '/test/repo');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('fatal: unable to access remote repository');
    });
  });
});