import { describe, it, expect, beforeEach } from 'vitest';
import { TextEditorViewTool } from './TextEditorViewTool';
import type { JSRuntimeFS, DirectoryEntry } from '../JSRuntime';

// Mock filesystem for testing
class MockFS implements JSRuntimeFS {
  private files: Map<string, string> = new Map();
  private dirs: Set<string> = new Set();

  constructor() {
    // Set up a basic project structure
    this.dirs.add('/project');
    this.dirs.add('/project/.git');
    this.dirs.add('/project/src');
    this.dirs.add('/project/node_modules');

    this.files.set('/project/package.json', '{"name": "test"}');
    this.files.set('/project/src/index.ts', 'console.log("hello");');
    this.files.set('/project/.gitignore', 'node_modules\n.git\n');
  }

  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, encoding: 'utf8'): Promise<string>;
  async readFile(path: string, encoding: string): Promise<string>;
  async readFile(path: string, encoding?: string): Promise<string | Uint8Array>;
  async readFile(path: string, encoding?: string): Promise<string | Uint8Array> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return encoding ? content : new TextEncoder().encode(content);
  }

  async writeFile(path: string, data: string | Uint8Array, _encoding?: string): Promise<void> {
    const content = typeof data === 'string' ? data : new TextDecoder().decode(data);
    this.files.set(path, content);
  }

  async readdir(path: string): Promise<string[]>;
  async readdir(path: string, options: { withFileTypes: true }): Promise<DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]> {
    const entries: string[] = [];

    // Find all files and directories that are direct children of this path
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(path + '/')) {
        const relativePath = filePath.slice(path.length + 1);
        const parts = relativePath.split('/');
        if (parts.length === 1) {
          entries.push(parts[0]);
        }
      }
    }

    for (const dirPath of this.dirs) {
      if (dirPath.startsWith(path + '/')) {
        const relativePath = dirPath.slice(path.length + 1);
        const parts = relativePath.split('/');
        if (parts.length === 1) {
          entries.push(parts[0]);
        }
      }
    }

    if (options?.withFileTypes) {
      return entries.map(name => ({
        name,
        isDirectory: () => this.dirs.has(`${path}/${name}`),
        isFile: () => this.files.has(`${path}/${name}`)
      }));
    }

    return entries;
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
}

describe('TextEditorViewTool', () => {
  let mockFS: MockFS;
  let tool: TextEditorViewTool;

  beforeEach(() => {
    mockFS = new MockFS();
    tool = new TextEditorViewTool(mockFS, '/project');
  });

  it('should handle viewing current directory without ignore library errors', async () => {
    const result = await tool.execute({ path: '.' });

    expect(result).toContain('src/');
    expect(result).toContain('package.json');
    // .git should be filtered out by gitignore, but .gitignore should be present
    expect(result).toContain('.gitignore');
    expect(result).not.toContain('.git/'); // Check for .git directory specifically
  });

  it('should handle viewing subdirectory', async () => {
    const result = await tool.execute({ path: 'src' });

    expect(result).toContain('index.ts');
  });

  it('should handle viewing a file', async () => {
    const result = await tool.execute({ path: 'src/index.ts' });

    expect(result).toBe('console.log("hello");');
  });

  it('should handle line filtering', async () => {
    const result = await tool.execute({
      path: 'src/index.ts',
      start_line: 1,
      end_line: 1
    });

    expect(result).toBe('console.log("hello");');
  });
});