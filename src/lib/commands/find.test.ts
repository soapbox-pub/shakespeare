import { describe, it, expect, beforeEach } from 'vitest';
import { FindCommand } from './find';
import type { JSRuntimeFS } from '../JSRuntime';

// Mock filesystem
const mockFS = {
  stat: async (path: string) => {
    if (path === '/project/test.txt') {
      return { isFile: () => true, isDirectory: () => false };
    }
    if (path === '/project' || path === '/project/src') {
      return { isFile: () => false, isDirectory: () => true };
    }
    throw new Error('ENOENT: not found');
  },
  readdir: async (path: string, _options: { withFileTypes: boolean }) => {
    if (path === '/project') {
      return [
        { name: 'test.txt', isFile: () => true, isDirectory: () => false },
        { name: 'package.json', isFile: () => true, isDirectory: () => false },
        { name: 'src', isFile: () => false, isDirectory: () => true },
      ];
    }
    if (path === '/project/src') {
      return [
        { name: 'index.ts', isFile: () => true, isDirectory: () => false },
        { name: 'utils.ts', isFile: () => true, isDirectory: () => false },
      ];
    }
    return [];
  },
} as unknown as JSRuntimeFS;

describe('FindCommand', () => {
  let command: FindCommand;

  beforeEach(() => {
    command = new FindCommand(mockFS);
  });

  it('should have correct name and description', () => {
    expect(command.name).toBe('find');
    expect(command.description).toBe('Search for files and directories');
    expect(command.usage).toBe('find [path...] [-name pattern] [-type f|d]');
  });

  it('should find all files and directories by default', async () => {
    const result = await command.execute(['.'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('.');
    expect(result.stdout).toContain('./test.txt');
    expect(result.stdout).toContain('./package.json');
    expect(result.stdout).toContain('./src');
    expect(result.stdout).toContain('./src/index.ts');
  });

  it('should filter by file type with -type f', async () => {
    const result = await command.execute(['.', '-type', 'f'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('./test.txt');
    expect(result.stdout).toContain('./package.json');
    expect(result.stdout.split('\n')).not.toContain('./src');
  });

  it('should filter by directory type with -type d', async () => {
    const result = await command.execute(['.', '-type', 'd'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('.');
    expect(result.stdout).toContain('./src');
    expect(result.stdout).not.toContain('./test.txt');
  });

  it('should filter by name pattern', async () => {
    const result = await command.execute(['.', '-name', '*.ts'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('./src/index.ts');
    expect(result.stdout).toContain('./src/utils.ts');
    expect(result.stdout).not.toContain('./test.txt');
  });

  it('should combine name and type filters', async () => {
    const result = await command.execute(['.', '-name', '*.ts', '-type', 'f'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('./src/index.ts');
    expect(result.stdout).toContain('./src/utils.ts');
    expect(result.stdout.split('\n')).not.toContain('./src');
  });

  it('should handle file not found', async () => {
    const result = await command.execute(['nonexistent'], '/project');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No such file or directory');
  });

  it('should reject absolute paths', async () => {
    const result = await command.execute(['/absolute/path'], '/project');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('absolute paths are not supported');
  });

  it('should default to current directory when no path specified', async () => {
    const result = await command.execute(['-name', '*.txt'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('./test.txt');
  });
});