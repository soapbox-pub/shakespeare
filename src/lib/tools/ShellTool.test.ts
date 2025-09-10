import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShellTool } from './ShellTool';
import type { JSRuntimeFS } from '../JSRuntime';

// Mock filesystem
const createMockFS = (): JSRuntimeFS => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  mkdir: vi.fn(),
  stat: vi.fn(),
  lstat: vi.fn(),
  unlink: vi.fn(),
  rmdir: vi.fn(),
  rename: vi.fn(),
  readlink: vi.fn(),
  symlink: vi.fn(),
});

describe('ShellTool', () => {
  let mockFS: JSRuntimeFS;
  let shellTool: ShellTool;
  const testCwd = '/test/dir';

  beforeEach(() => {
    mockFS = createMockFS();
    shellTool = new ShellTool(mockFS, testCwd);
  });

  it('should have correct tool properties', () => {
    expect(shellTool.description).toBe('Execute shell commands like cat, ls, cd, pwd, rm, cp, mv');
    expect(shellTool.inputSchema).toBeDefined();
  });

  it('should return error for empty command', async () => {
    const result = await shellTool.execute({ command: '' });
    expect(result).toBe('Error: Empty command');
  });

  it('should return error for whitespace-only command', async () => {
    const result = await shellTool.execute({ command: '   ' });
    expect(result).toBe('Error: Empty command');
  });

  it('should return error for unknown command', async () => {
    const result = await shellTool.execute({ command: 'unknowncommand' });
    expect(result).toContain("Command 'unknowncommand' not found");
    expect(result).toContain('Available commands: cat');
  });

  it('should execute cat command successfully', async () => {
    const fileContent = 'Hello, World!';
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    vi.mocked(mockFS.readFile).mockResolvedValue(fileContent);

    const result = await shellTool.execute({ command: 'cat test.txt' });

    expect(result).toBe(fileContent);
  });

  it('should parse commands with arguments correctly', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce('File 1\n')
      .mockResolvedValueOnce('File 2\n');

    const result = await shellTool.execute({ command: 'cat file1.txt file2.txt' });

    expect(result).toBe('File 1\nFile 2\n');
  });

  it('should handle quoted arguments', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    vi.mocked(mockFS.readFile).mockResolvedValue('Content');

    await shellTool.execute({ command: 'cat "file with spaces.txt"' });

    expect(mockFS.readFile).toHaveBeenCalledWith('/test/dir/file with spaces.txt', 'utf8');
  });

  it('should return current working directory', () => {
    expect(shellTool.getCurrentWorkingDirectory()).toBe(testCwd);
  });

  it('should allow setting working directory', () => {
    const newCwd = '/new/dir';
    shellTool.setCurrentWorkingDirectory(newCwd);
    expect(shellTool.getCurrentWorkingDirectory()).toBe(newCwd);
  });

  it('should return available commands', () => {
    const commands = shellTool.getAvailableCommands();
    expect(commands).toHaveLength(1);
    expect(commands[0]).toEqual({
      name: 'cat',
      description: 'Concatenate and display file contents',
      usage: 'cat [file...]',
    });
  });

  it('should handle command errors gracefully', async () => {
    vi.mocked(mockFS.stat).mockRejectedValue(new Error('ENOENT: no such file or directory'));

    const result = await shellTool.execute({ command: 'cat nonexistent.txt' });

    expect(result).toContain('No such file or directory');
    expect(result).toContain('Exit code: 1');
  });

  it('should show stderr output', async () => {
    const result = await shellTool.execute({ command: 'cat' });

    expect(result).toContain('missing file operand');
    expect(result).toContain('Exit code: 1');
  });
});