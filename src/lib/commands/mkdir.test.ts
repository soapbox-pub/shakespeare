import { describe, it, expect, beforeEach } from 'vitest';
import { MkdirCommand } from './mkdir';
import type { JSRuntimeFS } from '../JSRuntime';

// Mock filesystem
const mockFS = {
  stat: async (path: string) => {
    if (path === '/project/existing') {
      return { isFile: () => false, isDirectory: () => true };
    }
    if (path === '/project/file.txt') {
      return { isFile: () => true, isDirectory: () => false };
    }
    if (path === '/project') {
      return { isFile: () => false, isDirectory: () => true };
    }
    throw new Error('ENOENT: not found');
  },
  mkdir: async (path: string) => {
    if (path === '/project/newdir' || path === '/project/deep' || path === '/project/deep/nested') {
      return; // Success
    }
    throw new Error('mkdir failed');
  },
} as unknown as JSRuntimeFS;

describe('MkdirCommand', () => {
  let command: MkdirCommand;

  beforeEach(() => {
    command = new MkdirCommand(mockFS);
  });

  it('should have correct name and description', () => {
    expect(command.name).toBe('mkdir');
    expect(command.description).toBe('Create directories');
    expect(command.usage).toBe('mkdir [-p] directory...');
  });

  it('should create new directory', async () => {
    const result = await command.execute(['newdir'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('should handle existing directory error', async () => {
    const result = await command.execute(['existing'], '/project');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('File exists');
  });

  it('should handle existing file error', async () => {
    const result = await command.execute(['file.txt'], '/project');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('File exists');
  });

  it('should create parent directories with -p', async () => {
    const result = await command.execute(['-p', 'deep/nested'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('should handle missing parent directory without -p', async () => {
    const result = await command.execute(['nonexistent/newdir'], '/project');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No such file or directory');
  });

  it('should require directory operand', async () => {
    const result = await command.execute([], '/project');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('missing operand');
  });

  it('should reject absolute paths outside allowed directories', async () => {
    const result = await command.execute(['/absolute/path'], '/project');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('write access denied');
  });

  it('should handle multiple directories', async () => {
    const result = await command.execute(['newdir', 'deep'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });
});