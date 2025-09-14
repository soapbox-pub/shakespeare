import { describe, it, expect, beforeEach } from 'vitest';
import { TouchCommand } from './touch';
import type { JSRuntimeFS } from '../JSRuntime';

// Mock filesystem
const mockFS = {
  stat: async (path: string) => {
    if (path === '/project/existing.txt') {
      return { isFile: () => true, isDirectory: () => false };
    }
    if (path === '/project/dir') {
      return { isFile: () => false, isDirectory: () => true };
    }
    if (path === '/project') {
      return { isFile: () => false, isDirectory: () => true };
    }
    throw new Error('ENOENT: not found');
  },
  writeFile: async (path: string, _content: string, _encoding: string) => {
    if (path === '/project/newfile.txt') {
      return; // Success
    }
    throw new Error('Write failed');
  },
} as unknown as JSRuntimeFS;

describe('TouchCommand', () => {
  let command: TouchCommand;

  beforeEach(() => {
    command = new TouchCommand(mockFS);
  });

  it('should have correct name and description', () => {
    expect(command.name).toBe('touch');
    expect(command.description).toBe('Create empty files or update timestamps');
    expect(command.usage).toBe('touch file...');
  });

  it('should create new file', async () => {
    const result = await command.execute(['newfile.txt'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('should handle existing file (no-op)', async () => {
    const result = await command.execute(['existing.txt'], '/project');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('should handle directory error', async () => {
    const result = await command.execute(['dir'], '/project');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Is a directory');
  });

  it('should require file operand', async () => {
    const result = await command.execute([], '/project');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('missing file operand');
  });

  it('should reject absolute paths outside allowed directories', async () => {
    const result = await command.execute(['/absolute/path'], '/project');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('write access denied');
  });

  it('should handle missing parent directory', async () => {
    const result = await command.execute(['nonexistent/file.txt'], '/project');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No such file or directory');
  });
});