import { describe, it, expect, beforeEach } from 'vitest';
import { GrepCommand } from './grep';
import type { JSRuntimeFS } from '../JSRuntime';

// Mock filesystem
const mockFS = {
  stat: async (path: string) => {
    if (path === '/project/test.txt') {
      return { isFile: () => true, isDirectory: () => false };
    }
    if (path === '/project/dir') {
      return { isFile: () => false, isDirectory: () => true };
    }
    throw new Error('ENOENT: not found');
  },
  readFile: async (path: string, _encoding: string) => {
    if (path === '/project/test.txt') {
      return 'Hello World\nThis is a test\nHELLO again\nAnother line\ntest file';
    }
    throw new Error('ENOENT: not found');
  },
  readdir: async (path: string, _options: { withFileTypes: boolean }) => {
    if (path === '/project/dir') {
      return [
        { name: 'file1.txt', isFile: () => true, isDirectory: () => false },
        { name: 'file2.txt', isFile: () => true, isDirectory: () => false },
      ];
    }
    return [];
  },
} as unknown as JSRuntimeFS;

describe('GrepCommand', () => {
  let command: GrepCommand;

  beforeEach(() => {
    command = new GrepCommand(mockFS);
  });

  it('should have correct name and description', () => {
    expect(command.name).toBe('grep');
    expect(command.description).toBe('Search for patterns in files');
    expect(command.usage).toBe('grep [-i] [-n] [-r] pattern [file...]');
  });

  it('should search for pattern in file', async () => {
    const result = await command.execute(['test', 'test.txt'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('This is a test');
    expect(result.stdout).toContain('test file');
  });

  it('should search case-insensitive with -i', async () => {
    const result = await command.execute(['-i', 'hello', 'test.txt'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Hello World');
    expect(result.stdout).toContain('HELLO again');
  });

  it('should show line numbers with -n', async () => {
    const result = await command.execute(['-n', 'test', 'test.txt'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('2:This is a test');
    expect(result.stdout).toContain('5:test file');
  });

  it('should return exit code 1 when no matches found', async () => {
    const result = await command.execute(['nonexistent', 'test.txt'], '/project');

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
  });

  it('should handle file not found', async () => {
    const result = await command.execute(['pattern', 'nonexistent.txt'], '/project');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No such file or directory');
  });

  it('should handle directory without -r flag', async () => {
    const result = await command.execute(['pattern', 'dir'], '/project');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Is a directory');
  });

  it('should require pattern argument', async () => {
    const result = await command.execute([], '/project');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('missing pattern');
  });

  it('should reject absolute paths', async () => {
    const result = await command.execute(['pattern', '/absolute/path'], '/project');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('absolute paths are not supported');
  });

  it('should reject stdin', async () => {
    const result = await command.execute(['pattern', '-'], '/project');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('reading from stdin is not supported');
  });
});