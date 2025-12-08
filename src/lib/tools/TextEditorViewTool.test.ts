import { describe, it, expect, beforeEach } from 'vitest';
import { TextEditorViewTool } from './TextEditorViewTool';
import type { JSRuntimeFS, DirectoryEntry } from '../JSRuntime';

// Mock filesystem for testing
class MockFS implements JSRuntimeFS {
  private files: Map<string, string> = new Map();
  private dirs: Set<string> = new Set();

  constructor() {
    // Set up a basic project structure
    this.dirs.add('/projects');
    this.dirs.add('/projects/project1');
    this.dirs.add('/projects/project1/src');
    this.dirs.add('/projects/project1/.git');
    this.dirs.add('/projects/project2');
    this.dirs.add('/projects/project2/src');
    this.dirs.add('/project');
    this.dirs.add('/project/.git');
    this.dirs.add('/project/src');
    this.dirs.add('/project/node_modules');
    this.dirs.add('/tmp');

    this.files.set('/projects/project1/package.json', '{"name": "project1"}');
    this.files.set('/projects/project1/src/index.ts', 'console.log("project1");');
    this.files.set('/projects/project1/.git/config', '[core]\nrepositoryformatversion = 0');
    this.files.set('/projects/project1/.git/HEAD', 'ref: refs/heads/main');
    this.files.set('/projects/project2/package.json', '{"name": "project2"}');
    this.files.set('/projects/project2/src/main.ts', 'console.log("project2");');
    this.files.set('/project/package.json', '{"name": "test"}');
    this.files.set('/project/src/index.ts', 'console.log("hello");');
    this.files.set('/project/.gitignore', 'node_modules\n.git\n');
    this.files.set('/project/.git/config', '[core]\nrepositoryformatversion = 0');
    this.files.set('/project/.git/HEAD', 'ref: refs/heads/main');
    this.files.set('/tmp/uploaded-file.txt', 'This is an uploaded file');

    // Add binary files for testing
    this.files.set('/project/logo.png', 'BINARY_CONTENT_PNG');
    this.files.set('/project/document.pdf', 'BINARY_CONTENT_PDF');
    this.files.set('/tmp/image.jpg', 'BINARY_CONTENT_JPG');
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
    // If no encoding specified, return Uint8Array
    if (!encoding) {
      // For binary files, return mock binary data with null bytes
      if (content.startsWith('BINARY_CONTENT')) {
        const binaryData = new Uint8Array(100);
        binaryData[0] = 0; // Add null byte to make it appear binary
        binaryData[1] = 255; // Add some non-printable bytes
        binaryData[2] = 0;
        // Fill rest with some pattern
        for (let i = 3; i < 100; i++) {
          binaryData[i] = i % 256;
        }
        return binaryData;
      }
      return new TextEncoder().encode(content);
    }

    return content;
  }

  async writeFile(path: string, data: string | Uint8Array, _options?: string | { encoding?: string }): Promise<void> {
    const content = typeof data === 'string' ? data : new TextDecoder().decode(data);
    this.files.set(path, content);
  }

  async readdir(path: string): Promise<string[]>;
  async readdir(path: string, options: { withFileTypes: true }): Promise<DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]> {
    // Normalize path by removing trailing slash
    const normalizedPath = path.replace(/\/$/, '') || '/';
    const entries: string[] = [];

    // Find all files and directories that are direct children of this path
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(normalizedPath + '/')) {
        const relativePath = filePath.slice(normalizedPath.length + 1);
        const parts = relativePath.split('/');
        if (parts.length === 1) {
          entries.push(parts[0]);
        }
      }
    }

    for (const dirPath of this.dirs) {
      if (dirPath.startsWith(normalizedPath + '/')) {
        const relativePath = dirPath.slice(normalizedPath.length + 1);
        const parts = relativePath.split('/');
        if (parts.length === 1) {
          entries.push(parts[0]);
        }
      }
    }

    if (options?.withFileTypes) {
      return entries.map(name => ({
        name,
        isDirectory: () => this.dirs.has(`${normalizedPath}/${name}`),
        isFile: () => this.files.has(`${normalizedPath}/${name}`)
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
    // Normalize path by removing trailing slash for directories
    const normalizedPath = path.replace(/\/$/, '') || '/';

    if (this.dirs.has(normalizedPath)) {
      return {
        isDirectory: () => true,
        isFile: () => false,
        size: 0,
        mtimeMs: Date.now()
      };
    }

    if (this.files.has(normalizedPath)) {
      return {
        isDirectory: () => false,
        isFile: () => true,
        size: this.files.get(normalizedPath)!.length,
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

  it('should handle viewing current directory', async () => {
    const result = await tool.execute({ path: '.' });

    expect(result.content).toContain('src/');
    expect(result.content).toContain('package.json');
    expect(result.content).toContain('.gitignore');
    expect(result.content).toContain('.git/'); // .git directory should now be visible
  });

  it('should handle viewing subdirectory', async () => {
    const result = await tool.execute({ path: 'src' });

    expect(result.content).toContain('index.ts');
  });

  it('should handle viewing a file', async () => {
    const result = await tool.execute({ path: 'src/index.ts' });

    expect(result.content).toBe('console.log("hello");');
  });

  it('should handle line filtering', async () => {
    const result = await tool.execute({
      path: 'src/index.ts',
      start_line: 1,
      end_line: 1
    });

    expect(result.content).toBe('console.log("hello");');
  });

  it('should handle absolute paths', async () => {
    const result = await tool.execute({ path: '/tmp/uploaded-file.txt' });

    expect(result.content).toBe('This is an uploaded file');
  });

  it('should handle absolute directory paths', async () => {
    const result = await tool.execute({ path: '/tmp' });

    expect(result.content).toContain('uploaded-file.txt');
  });

  it('should handle absolute paths with line filtering', async () => {
    const result = await tool.execute({
      path: '/tmp/uploaded-file.txt',
      start_line: 1,
      end_line: 1
    });

    expect(result.content).toBe('This is an uploaded file');
  });

  it('should detect binary files by extension and show placeholder', async () => {
    const result = await tool.execute({ path: 'logo.png' });

    expect(result.content).toContain('[Binary file: PNG file');
    expect(result.content).toContain('This appears to be a binary file and cannot be displayed as text.');
    expect(result.content).not.toContain('BINARY_CONTENT_PNG');
  });

  it('should detect PDF files as binary', async () => {
    const result = await tool.execute({ path: 'document.pdf' });

    expect(result.content).toContain('[Binary file: PDF file');
    expect(result.content).toContain('This appears to be a binary file and cannot be displayed as text.');
  });

  it('should detect binary files with absolute paths', async () => {
    const result = await tool.execute({ path: '/tmp/image.jpg' });

    expect(result.content).toContain('[Binary file: JPG file');
    expect(result.content).toContain('This appears to be a binary file and cannot be displayed as text.');
  });

  it('should show only project directories when viewing /projects', async () => {
    const result = await tool.execute({ path: '/projects' });

    // Should show the project directories
    expect(result.content).toContain('project1/');
    expect(result.content).toContain('project2/');

    // Should NOT show the contents of the project directories (depth 1 only)
    expect(result.content).not.toContain('package.json');
    expect(result.content).not.toContain('src/');
    expect(result.content).not.toContain('index.ts');
    expect(result.content).not.toContain('main.ts');
  });

  it('should show only project directories when viewing /projects/', async () => {
    const result = await tool.execute({ path: '/projects/' });

    // Should show the project directories
    expect(result.content).toContain('project1/');
    expect(result.content).toContain('project2/');

    // Should NOT show the contents of the project directories (depth 1 only)
    expect(result.content).not.toContain('package.json');
    expect(result.content).not.toContain('src/');
    expect(result.content).not.toContain('index.ts');
    expect(result.content).not.toContain('main.ts');
  });

  it('should show .git directory but not traverse its contents when viewing project root', async () => {
    const result = await tool.execute({ path: '/project' });

    // Should show the .git directory
    expect(result.content).toContain('.git/');

    // Should show "..." under .git instead of its contents
    expect(result.content).toContain('...');

    // Should NOT show .git file contents
    expect(result.content).not.toContain('config');
    expect(result.content).not.toContain('HEAD');
    expect(result.content).not.toContain('repositoryformatversion');

    // Should still show other directory contents normally
    expect(result.content).toContain('src/');
    expect(result.content).toContain('package.json');
  });

  it('should show .git contents when explicitly viewing .git directory', async () => {
    const result = await tool.execute({ path: '/project/.git' });

    // Should show the .git file contents when explicitly requested
    expect(result.content).toContain('config');
    expect(result.content).toContain('HEAD');

    // Should NOT show "..." when explicitly viewing .git
    expect(result.content).not.toContain('...');
  });

  it('should show .git contents when explicitly viewing .git with relative path', async () => {
    const result = await tool.execute({ path: '.git' });

    // Should show the .git file contents when explicitly requested
    expect(result.content).toContain('config');
    expect(result.content).toContain('HEAD');

    // Should NOT show "..." when explicitly viewing .git
    expect(result.content).not.toContain('...');
  });
});