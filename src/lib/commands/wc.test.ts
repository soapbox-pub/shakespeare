import { describe, it, expect, beforeEach } from 'vitest';
import { WcCommand } from './wc';
import type { JSRuntimeFS } from '../JSRuntime';

// Mock filesystem
const mockFS = {
  stat: async (path: string) => {
    if (path === '/project/test.txt') {
      return { isFile: () => true, isDirectory: () => false };
    }
    if (path === '/project/empty.txt') {
      return { isFile: () => true, isDirectory: () => false };
    }
    if (path === '/project/dir') {
      return { isFile: () => false, isDirectory: () => true };
    }
    throw new Error('ENOENT: not found');
  },
  readFile: async (path: string, _encoding: string) => {
    if (path === '/project/test.txt') {
      return 'Hello world\nThis is a test file\nWith multiple lines\n';
    }
    if (path === '/project/empty.txt') {
      return '';
    }
    throw new Error('ENOENT: not found');
  },
} as unknown as JSRuntimeFS;

describe('WcCommand', () => {
  let command: WcCommand;

  beforeEach(() => {
    command = new WcCommand(mockFS);
  });

  it('should have correct name and description', () => {
    expect(command.name).toBe('wc');
    expect(command.description).toBe('Count lines, words, and characters in files');
    expect(command.usage).toBe('wc [-l] [-w] [-c] [file...]');
  });

  it('should count lines, words, and characters by default', async () => {
    const result = await command.execute(['test.txt'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\s+3\s+10\s+52 test\.txt/);
  });

  it('should count only lines with -l', async () => {
    const result = await command.execute(['-l', 'test.txt'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\s+3 test\.txt/);
  });

  it('should count only words with -w', async () => {
    const result = await command.execute(['-w', 'test.txt'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\s+10 test\.txt/);
  });

  it('should count only characters with -c', async () => {
    const result = await command.execute(['-c', 'test.txt'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\s+52 test\.txt/);
  });

  it('should handle empty file', async () => {
    const result = await command.execute(['empty.txt'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\s+0\s+0\s+0 empty\.txt/);
  });

  it('should show totals for multiple files', async () => {
    const result = await command.execute(['test.txt', 'empty.txt'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('test.txt');
    expect(result.stdout).toContain('empty.txt');
    expect(result.stdout).toContain('total');
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