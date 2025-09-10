import { describe, it, expect, beforeEach } from 'vitest';
import { TailCommand } from './tail';
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
      return 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nline 10\nline 11\nline 12\n';
    }
    throw new Error('ENOENT: not found');
  },
} as unknown as JSRuntimeFS;

describe('TailCommand', () => {
  let command: TailCommand;

  beforeEach(() => {
    command = new TailCommand(mockFS);
  });

  it('should have correct name and description', () => {
    expect(command.name).toBe('tail');
    expect(command.description).toBe('Display the last lines of files');
    expect(command.usage).toBe('tail [-n lines] [file...]');
  });

  it('should show last 10 lines by default', async () => {
    const result = await command.execute(['test.txt'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('line 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nline 10\nline 11\nline 12\n');
  });

  it('should show custom number of lines with -n', async () => {
    const result = await command.execute(['-n', '3', 'test.txt'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('line 10\nline 11\nline 12\n');
  });

  it('should show custom number of lines with -n3 format', async () => {
    const result = await command.execute(['-n3', 'test.txt'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('line 10\nline 11\nline 12\n');
  });

  it('should handle file not found', async () => {
    const result = await command.execute(['nonexistent.txt'], '/project');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No such file or directory');
  });

  it('should handle directory error', async () => {
    const result = await command.execute(['dir'], '/project');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Is a directory');
  });

  it('should reject absolute paths', async () => {
    const result = await command.execute(['/absolute/path'], '/project');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('absolute paths are not supported');
  });

  it('should reject stdin', async () => {
    const result = await command.execute(['-'], '/project');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('reading from stdin is not supported');
  });
});