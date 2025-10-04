import { describe, it, expect, beforeEach } from 'vitest';
import { TextEditorStrReplaceTool } from './TextEditorStrReplaceTool';
import type { JSRuntimeFS, DirectoryEntry } from '../JSRuntime';

// Simple mock filesystem for testing
class MockFS implements JSRuntimeFS {
  private files: Map<string, string> = new Map();
  private dirs: Set<string> = new Set();

  constructor() {
    this.dirs.add('/project');
    this.dirs.add('/project/src');
    this.files.set('/project/src/test.ts', 'const message = "hello world";\nconsole.log(message);');
  }

  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, options: 'utf8'): Promise<string>;
  async readFile(path: string, options: string): Promise<string>;
  async readFile(path: string, options: { encoding: 'utf8' }): Promise<string>;
  async readFile(path: string, options: { encoding: string }): Promise<string>;
  async readFile(path: string, options?: string | { encoding?: string }): Promise<string | Uint8Array>;
  async readFile(path: string, options?: string | { encoding?: string }): Promise<string | Uint8Array> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    const encoding = typeof options === 'string' ? options : options?.encoding;
    return encoding ? content : new TextEncoder().encode(content);
  }

  async writeFile(path: string, data: string | Uint8Array, _options?: string | { encoding?: string }): Promise<void> {
    const content = typeof data === 'string' ? data : new TextDecoder().decode(data);
    this.files.set(path, content);
  }

  async readdir(path: string): Promise<string[]>;
  async readdir(path: string, options: { withFileTypes: true }): Promise<DirectoryEntry[]>;
  async readdir(_path: string, _options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]> {
    return [];
  }

  async mkdir(path: string, _options?: { recursive?: boolean }): Promise<void> {
    this.dirs.add(path);
  }

  async stat(path: string): Promise<{
    isDirectory(): boolean;
    isFile(): boolean;
    size?: number;
    mtimeMs?: number;
  }> {
    if (this.dirs.has(path)) {
      return {
        isDirectory: () => true,
        isFile: () => false,
        size: 0,
        mtimeMs: Date.now()
      };
    }

    if (this.files.has(path)) {
      return {
        isDirectory: () => false,
        isFile: () => true,
        size: this.files.get(path)!.length,
        mtimeMs: Date.now()
      };
    }

    throw new Error(`Path not found: ${path}`);
  }

  async lstat(path: string) {
    return this.stat(path);
  }

  async unlink(path: string): Promise<void> {
    this.files.delete(path);
  }

  async rmdir(path: string): Promise<void> {
    this.dirs.delete(path);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    if (this.files.has(oldPath)) {
      this.files.set(newPath, this.files.get(oldPath)!);
      this.files.delete(oldPath);
    }
  }

  async readlink(_path: string): Promise<string> {
    throw new Error('Symlinks not supported in mock');
  }

  async symlink(_target: string, _path: string): Promise<void> {
    throw new Error('Symlinks not supported in mock');
  }

  // Helper method to get file content
  getFileContent(path: string): string | undefined {
    return this.files.get(path);
  }
}

describe('TextEditorStrReplaceTool', () => {
  let mockFS: MockFS;
  let tool: TextEditorStrReplaceTool;

  beforeEach(() => {
    mockFS = new MockFS();
    tool = new TextEditorStrReplaceTool(mockFS, '/project');
  });

  it('should replace string in file successfully', async () => {
    const result = await tool.execute({
      path: 'src/test.ts',
      old_str: 'hello world',
      new_str: 'hello universe'
    });

    expect(result).toContain('String successfully replaced in src/test.ts');
    expect(mockFS.getFileContent('/project/src/test.ts')).toContain('hello universe');
    expect(mockFS.getFileContent('/project/src/test.ts')).not.toContain('hello world');
  });

  it('should handle string not found', async () => {
    await expect(tool.execute({
      path: 'src/test.ts',
      old_str: 'nonexistent string',
      new_str: 'replacement'
    })).rejects.toThrow('The string to replace was not found in src/test.ts');
  });

  it('should reject absolute paths with helpful error message', async () => {
    await expect(tool.execute({
      path: '/absolute/path/test.ts',
      old_str: 'old',
      new_str: 'new'
    })).rejects.toThrow('Write access denied');
  });

  it('should allow writes to /tmp/ directory', async () => {
    // First create the file in /tmp/
    await mockFS.writeFile('/tmp/temp-file.txt', 'original content');

    const result = await tool.execute({
      path: '/tmp/temp-file.txt',
      old_str: 'original',
      new_str: 'modified'
    });

    expect(result).toContain('String successfully replaced');
    expect(mockFS.getFileContent('/tmp/temp-file.txt')).toBe('modified content');
  });

  it('should handle whitespace normalization', async () => {
    const result = await tool.execute({
      path: 'src/test.ts',
      old_str: 'const message = "hello world";',
      new_str: 'const greeting = "hello universe";',
      normalize_whitespace: true
    });

    expect(result).toContain('String successfully replaced');
    expect(mockFS.getFileContent('/project/src/test.ts')).toContain('const greeting = "hello universe";');
  });
});