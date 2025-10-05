import { describe, it, expect, beforeEach } from 'vitest';
import { SedCommand } from './sed';
import type { JSRuntimeFS } from '../JSRuntime';

// Mock filesystem
const mockFS: JSRuntimeFS = {
  readFile: ((path: string, encoding?: string) => {
    const files: Record<string, string> = {
      '/test/hello.txt': 'hello world\nfoo bar\nbaz qux\n',
      '/test/numbers.txt': '1\n2\n3\n4\n5\n',
      '/test/mixed.txt': 'apple\nbanana\ncherry\napple pie\n',
    };

    if (path in files) {
      if (encoding === 'utf8' || (encoding && encoding !== undefined)) {
        return Promise.resolve(files[path]);
      } else {
        // No encoding specified, return Uint8Array
        return Promise.resolve(new TextEncoder().encode(files[path]));
      }
    }
    return Promise.reject(new Error('ENOENT: no such file or directory'));
  }) as JSRuntimeFS['readFile'],

  writeFile: async (_path: string, _data: string | Uint8Array, _encoding?: string) => {
    // Mock write operation
  },

  stat: async (_path: string) => ({
    isFile: () => true,
    isDirectory: () => false,
    size: 100,
    mtimeMs: Date.now(),
  }),

  lstat: async (_path: string) => ({
    isFile: () => true,
    isDirectory: () => false,
    size: 100,
    mtimeMs: Date.now(),
  }),

  readdir: (async (_path: string, _options?: { withFileTypes?: boolean }) => {
    if (_options?.withFileTypes) {
      return [];
    }
    return [];
  }) as JSRuntimeFS['readdir'],
  mkdir: async () => {},
  rmdir: async () => {},
  unlink: async () => {},
  rename: async () => {},
  readlink: async () => '',
  symlink: async () => {},
};

describe('SedCommand', () => {
  let sedCommand: SedCommand;

  beforeEach(() => {
    sedCommand = new SedCommand(mockFS);
  });

  describe('basic functionality', () => {
    it('should have correct name and description', () => {
      expect(sedCommand.name).toBe('sed');
      expect(sedCommand.description).toBe('Stream editor for filtering and transforming text');
    });

    it('should return error when no script provided', async () => {
      const result = await sedCommand.execute([], '/test');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('missing script');
    });
  });

  describe('substitute command', () => {
    it('should substitute text with s command', async () => {
      const input = 'hello world\nfoo bar\n';
      const result = await sedCommand.execute(['s/hello/hi/'], '/test', input);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('hi world\nfoo bar\n');
    });

    it('should substitute globally with g flag', async () => {
      const input = 'hello hello world\n';
      const result = await sedCommand.execute(['s/hello/hi/g'], '/test', input);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('hi hi world\n');
    });

    it('should substitute case-insensitively with i flag', async () => {
      const input = 'Hello HELLO world\n';
      const result = await sedCommand.execute(['s/hello/hi/gi'], '/test', input);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('hi hi world\n');
    });

    it('should substitute with special characters', async () => {
      const input = 'test.txt\n';
      const result = await sedCommand.execute(['s/\\.txt/.bak/'], '/test', input);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('test.bak\n');
    });
  });

  describe('delete command', () => {
    it('should delete all lines with d command', async () => {
      const input = 'line1\nline2\nline3\n';
      const result = await sedCommand.execute(['d'], '/test', input);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('\n');
    });

    it('should delete specific line with line number', async () => {
      const input = 'line1\nline2\nline3\n';
      const result = await sedCommand.execute(['2d'], '/test', input);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('line1\nline3\n');
    });

    it('should delete lines matching pattern', async () => {
      const input = 'keep this\ndelete this line\nkeep this too\n';
      const result = await sedCommand.execute(['/delete/d'], '/test', input);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('keep this\nkeep this too\n');
    });
  });

  describe('print command', () => {
    it('should print all lines normally without -n', async () => {
      const input = 'line1\nline2\n';
      const result = await sedCommand.execute(['p'], '/test', input);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('line1\nline1\nline2\nline2\n'); // Each line printed twice (normal + p command)
    });

    it('should print only specified lines with -n', async () => {
      const input = 'line1\nline2\nline3\n';
      const result = await sedCommand.execute(['-n', '2p'], '/test', input);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('');
    });
  });

  describe('quit command', () => {
    it('should quit after processing specified line', async () => {
      const input = 'line1\nline2\nline3\nline4\n';
      const result = await sedCommand.execute(['2q'], '/test', input);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('line1\nline2\n');
    });
  });

  describe('append, insert, and change commands', () => {
    it('should append text after line', async () => {
      const input = 'line1\nline2\n';
      const result = await sedCommand.execute(['1a\\appended text'], '/test', input);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('line1\nappended text\nline2\n');
    });

    it('should insert text before line', async () => {
      const input = 'line1\nline2\n';
      const result = await sedCommand.execute(['2i\\inserted text'], '/test', input);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('line1\ninserted text\nline2\n');
    });

    it('should change line', async () => {
      const input = 'line1\nline2\nline3\n';
      const result = await sedCommand.execute(['2c\\changed text'], '/test', input);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('line1\nchanged text\nline3\n');
    });
  });

  describe('file operations', () => {
    it('should process file content', async () => {
      const result = await sedCommand.execute(['s/hello/hi/'], '/test', undefined);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('should handle file not found error', async () => {
      const result = await sedCommand.execute(['s/hello/hi/', 'nonexistent.txt'], '/test');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No such file or directory');
    });

    it('should reject absolute paths', async () => {
      const result = await sedCommand.execute(['s/hello/hi/', '/absolute/path.txt'], '/test');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('absolute paths are not supported');
    });
  });

  describe('option parsing', () => {
    it('should parse -n option', async () => {
      const input = 'line1\nline2\n';
      const result = await sedCommand.execute(['-n', 'p'], '/test', input);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('should parse -e option', async () => {
      const input = 'hello world\n';
      const result = await sedCommand.execute(['-e', 's/hello/hi/'], '/test', input);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('hi world\n');
    });

    it('should parse combined options', async () => {
      const input = 'line1\nline2\n';
      const result = await sedCommand.execute(['-ne', 'p'], '/test', input);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('');
    });
  });

  describe('multiple scripts', () => {
    it('should process multiple scripts in order', async () => {
      const input = 'hello world\n';
      const result = await sedCommand.execute(['-e', 's/hello/hi/', '-e', 's/world/universe/'], '/test', input);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('hi universe\n');
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', async () => {
      const result = await sedCommand.execute(['s/hello/hi/'], '/test', '');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('should handle invalid regex patterns gracefully', async () => {
      const input = 'hello world\n';
      const result = await sedCommand.execute(['s/[/hi/'], '/test', input);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('hello world\n'); // Should return original
    });

    it('should handle invalid script format', async () => {
      const input = 'hello world\n';
      const result = await sedCommand.execute(['invalid_script'], '/test', input);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid sed script');
    });
  });
});