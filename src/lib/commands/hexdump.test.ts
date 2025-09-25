import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HexdumpCommand } from './hexdump';
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

describe('HexdumpCommand', () => {
  let mockFS: JSRuntimeFS;
  let command: HexdumpCommand;
  const testCwd = '/test/dir';

  beforeEach(() => {
    mockFS = createMockFS();
    command = new HexdumpCommand(mockFS);
  });

  it('should have correct name and description', () => {
    expect(command.name).toBe('hexdump');
    expect(command.description).toBe('Display file contents in hexadecimal format');
    expect(command.usage).toBe('hexdump [-C] [-n length] [-s skip] [file...]');
  });

  it('should show error when no file is specified', async () => {
    const result = await command.execute([], testCwd);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('missing file operand');
  });

  it('should show error for non-existent file', async () => {
    vi.mocked(mockFS.stat).mockRejectedValue(new Error('ENOENT: no such file or directory'));

    const result = await command.execute(['nonexistent.txt'], testCwd);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No such file or directory');
  });

  it('should show error for directory', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    const result = await command.execute(['testdir'], testCwd);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Is a directory');
  });

  it('should display hexdump in default format', async () => {
    const content = 'Hello, World!\n';
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    vi.mocked(mockFS.readFile).mockResolvedValue(Buffer.from(content));

    const result = await command.execute(['test.txt'], testCwd);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('0000000');
    expect(result.stdout).toContain('000000e'); // Final offset
  });

  it('should display hexdump in canonical format with -C', async () => {
    const content = 'Hello, World!\n';
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    vi.mocked(mockFS.readFile).mockResolvedValue(Buffer.from(content));

    const result = await command.execute(['-C', 'test.txt'], testCwd);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('00000000');
    expect(result.stdout).toContain('|Hello, World!');
    expect(result.stdout).toContain('|'); // Should have ASCII representation
  });

  it('should handle -n length option', async () => {
    const content = 'Hello, World!\nThis is a longer line.';
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    vi.mocked(mockFS.readFile).mockResolvedValue(Buffer.from(content));

    const result = await command.execute(['-C', '-n', '5', 'test.txt'], testCwd);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('|Hello|');
    expect(result.stdout).not.toContain('World');
  });

  it('should handle -s skip option', async () => {
    const content = 'Hello, World!\n';
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    vi.mocked(mockFS.readFile).mockResolvedValue(Buffer.from(content));

    const result = await command.execute(['-C', '-s', '7', 'test.txt'], testCwd);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('00000007');
    expect(result.stdout).toContain('|World!');
    expect(result.stdout).not.toContain('Hello');
  });

  it('should handle -n and -s together', async () => {
    const content = 'Hello, World!\n';
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    vi.mocked(mockFS.readFile).mockResolvedValue(Buffer.from(content));

    const result = await command.execute(['-C', '-s', '7', '-n', '5', 'test.txt'], testCwd);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('00000007');
    expect(result.stdout).toContain('|World|');
    expect(result.stdout).not.toContain('Hello');
    expect(result.stdout).not.toContain('!');
  });

  it('should show error for invalid -n value', async () => {
    const result = await command.execute(['-n', 'invalid'], testCwd);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('invalid length');
  });

  it('should show error for invalid -s value', async () => {
    const result = await command.execute(['-s', 'invalid'], testCwd);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('invalid skip offset');
  });

  it('should show error for missing -n argument', async () => {
    const result = await command.execute(['-n'], testCwd);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('option requires an argument -- n');
  });

  it('should show error for missing -s argument', async () => {
    const result = await command.execute(['-s'], testCwd);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('option requires an argument -- s');
  });

  it('should show error for invalid option', async () => {
    const result = await command.execute(['-x'], testCwd);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('invalid option -- x');
  });

  it('should handle multiple files', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce(Buffer.from('ABC'))
      .mockResolvedValueOnce(Buffer.from('XYZ'));

    const result = await command.execute(['-C', 'file1.txt', 'file2.txt'], testCwd);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('==> file1.txt <==');
    expect(result.stdout).toContain('==> file2.txt <==');
    expect(result.stdout).toContain('|ABC|');
    expect(result.stdout).toContain('|XYZ|');
  });

  it('should handle piped input', async () => {
    const input = 'Hello, World!';
    const result = await command.execute(['-C'], testCwd, input);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('00000000');
    expect(result.stdout).toContain('|Hello, World!|');
  });

  it('should handle binary data correctly', async () => {
    // Create binary data with non-printable characters
    const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x7F, 0x80, 0xFF, 0x41, 0x42, 0x43]);
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    vi.mocked(mockFS.readFile).mockResolvedValue(binaryData);

    const result = await command.execute(['-C', 'binary.dat'], testCwd);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('00000000');
    expect(result.stdout).toContain('00 01 02 7f 80 ff 41 42  43');
    expect(result.stdout).toContain('|......ABC|'); // Non-printable chars shown as dots
  });

  it('should handle empty file', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    vi.mocked(mockFS.readFile).mockResolvedValue(Buffer.from(''));

    const result = await command.execute(['-C', 'empty.txt'], testCwd);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(''); // No output for empty file
  });

  it('should handle skip beyond file length', async () => {
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    vi.mocked(mockFS.readFile).mockResolvedValue(Buffer.from('Hi'));

    const result = await command.execute(['-C', '-s', '10', 'short.txt'], testCwd);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(''); // No output since skip is beyond file
  });
});