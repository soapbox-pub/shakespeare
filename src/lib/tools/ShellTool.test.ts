import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShellTool } from './ShellTool';
import { Git } from '../git';
import type { JSRuntimeFS } from '../JSRuntime';
import { NPool } from '@nostrify/nostrify';

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

const createMockNostr = (): NPool => ({
  req: vi.fn(),
  query: vi.fn(),
  event: vi.fn(),
  group: vi.fn(),
  relay: vi.fn(),
  relays: new Map(),
  close: vi.fn(),
}) as unknown as NPool;

describe('ShellTool', () => {
  let mockFS: JSRuntimeFS;
  let mockGit: Git;
  let mockNostr: NPool;
  let shellTool: ShellTool;
  const testCwd = '/test/dir';

  beforeEach(() => {
    mockFS = createMockFS();
    mockNostr = createMockNostr();
    mockGit = new Git({ fs: mockFS, nostr: mockNostr });
    shellTool = new ShellTool(mockFS, testCwd, mockGit);
  });

  it('should have correct tool properties', () => {
    expect(shellTool.description).toBe('Execute shell commands like cat, ls, cd, pwd, rm, cp, mv, echo, head, tail, grep, find, wc, touch, mkdir, sort, uniq, cut, tr, sed, diff, which, whoami, date, env, clear, git, curl, unzip, hexdump. Supports compound commands with &&, ||, ;, and | operators, and output redirection with > and >> operators');
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
    expect(result).toContain('Available commands:');
    expect(result).toContain('cat');
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
    expect(commands.length).toBeGreaterThan(1);

    // Check that cat command is included
    const catCommand = commands.find(cmd => cmd.name === 'cat');
    expect(catCommand).toEqual({
      name: 'cat',
      description: 'Concatenate and display file contents',
      usage: 'cat [file...]',
    });

    // Check that other commands are included
    const commandNames = commands.map(cmd => cmd.name);
    expect(commandNames).toContain('ls');
    expect(commandNames).toContain('cd');
    expect(commandNames).toContain('pwd');
    expect(commandNames).toContain('echo');
    expect(commandNames).toContain('rm');
    expect(commandNames).toContain('cp');
    expect(commandNames).toContain('mv');
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

  it('should execute echo command', async () => {
    const result = await shellTool.execute({ command: 'echo hello world' });

    expect(result).toBe('hello world\n');
  });

  it('should execute pwd command', async () => {
    const result = await shellTool.execute({ command: 'pwd' });

    expect(result).toBe(testCwd);
  });

  it('should handle cd command and update working directory', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    const result = await shellTool.execute({ command: 'cd subdir' });

    expect(result).toBe('(no output)');
    expect(shellTool.getCurrentWorkingDirectory()).toBe('/test/dir/subdir');
  });

  describe('output redirection', () => {
    it('should redirect output to file with > operator', async () => {
      const result = await shellTool.execute({ command: 'echo "hello world" > test.txt' });

      expect(result).toBe('(no output)');
      expect(mockFS.writeFile).toHaveBeenCalledWith('/test/dir/test.txt', 'hello world\n', 'utf8');
    });

    it('should append output to file with >> operator', async () => {
      vi.mocked(mockFS.readFile).mockResolvedValue('existing content\n');

      const result = await shellTool.execute({ command: 'echo "new line" >> test.txt' });

      expect(result).toBe('(no output)');
      expect(mockFS.readFile).toHaveBeenCalledWith('/test/dir/test.txt', 'utf8');
      expect(mockFS.writeFile).toHaveBeenCalledWith('/test/dir/test.txt', 'existing content\nnew line\n', 'utf8');
    });

    it('should create new file with >> operator if file does not exist', async () => {
      vi.mocked(mockFS.readFile).mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result = await shellTool.execute({ command: 'echo "first line" >> newfile.txt' });

      expect(result).toBe('(no output)');
      expect(mockFS.writeFile).toHaveBeenCalledWith('/test/dir/newfile.txt', 'first line\n', 'utf8');
    });

    it('should handle quoted filenames in redirection', async () => {
      const result = await shellTool.execute({ command: 'echo test > "file with spaces.txt"' });

      expect(result).toBe('(no output)');
      expect(mockFS.writeFile).toHaveBeenCalledWith('/test/dir/file with spaces.txt', 'test\n', 'utf8');
    });

    it('should handle absolute paths in redirection', async () => {
      const result = await shellTool.execute({ command: 'echo test > /tmp/absolute.txt' });

      expect(result).toBe('(no output)');
      expect(mockFS.writeFile).toHaveBeenCalledWith('/tmp/absolute.txt', 'test\n', 'utf8');
    });

    it('should handle redirection errors gracefully', async () => {
      vi.mocked(mockFS.writeFile).mockRejectedValue(new Error('Permission denied'));

      const result = await shellTool.execute({ command: 'echo test > /readonly/file.txt' });

      expect(result).toContain('Redirection error: Permission denied');
      expect(result).toContain('Exit code: 1');
    });
  });

  describe('compound commands', () => {
    it('should execute commands with && operator (success case)', async () => {
      const result = await shellTool.execute({ command: 'pwd && echo hello' });

      expect(result).toContain(testCwd);
      expect(result).toContain('hello');
    });

    it('should execute commands with && operator (failure case)', async () => {
      vi.mocked(mockFS.stat).mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result = await shellTool.execute({ command: 'cat nonexistent.txt && echo should not run' });

      expect(result).toContain('No such file or directory');
      expect(result).not.toContain('should not run');
    });

    it('should execute commands with || operator (success case)', async () => {
      const result = await shellTool.execute({ command: 'pwd || echo fallback' });

      expect(result).toContain(testCwd);
      expect(result).not.toContain('fallback');
    });

    it('should execute commands with || operator (failure case)', async () => {
      vi.mocked(mockFS.stat).mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result = await shellTool.execute({ command: 'cat nonexistent.txt || echo fallback' });

      expect(result).toContain('No such file or directory');
      expect(result).toContain('fallback');
    });

    it('should execute commands with ; operator', async () => {
      const result = await shellTool.execute({ command: 'echo first; echo second' });

      expect(result).toContain('first');
      expect(result).toContain('second');
    });

    it('should execute commands with pipe operator', async () => {
      const result = await shellTool.execute({ command: 'echo "hello world" | cat' });

      expect(result).toContain('hello world');
    });

    it('should handle complex compound commands', async () => {
      const result = await shellTool.execute({ command: 'echo "line1\nline2\nline3" | head -n 2' });

      expect(result).toContain('line1');
      expect(result).toContain('line2');
      expect(result).not.toContain('line3');
    });

    it('should parse quoted strings in compound commands', async () => {
      const result = await shellTool.execute({ command: 'echo "hello && world" && echo success' });

      expect(result).toContain('hello && world');
      expect(result).toContain('success');
    });
  });
});