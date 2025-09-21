import { describe, it, expect, beforeEach } from 'vitest';
import { generateUniqueFilename, saveFileToTmp } from './fileUtils';
import type { JSRuntimeFS } from './JSRuntime';

// Mock filesystem for testing
class MockFS implements JSRuntimeFS {
  private files = new Map<string, Uint8Array | string>();
  private directories = new Set<string>();

  constructor() {
    this.directories.add('/');
    this.directories.add('/tmp');
  }

  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, encoding: 'utf8'): Promise<string>;
  async readFile(path: string, encoding: string): Promise<string>;
  async readFile(path: string, encoding?: string): Promise<string | Uint8Array> {
    const data = this.files.get(path);
    if (!data) throw new Error(`File not found: ${path}`);

    if (encoding === 'utf8') {
      return typeof data === 'string' ? data : new TextDecoder().decode(data);
    }

    return data;
  }

  async writeFile(path: string, data: string | Uint8Array): Promise<void> {
    this.files.set(path, data);
  }

  async readdir(path: string): Promise<string[]>;
  async readdir(path: string, options: { withFileTypes: true }): Promise<import('./JSRuntime').DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | import('./JSRuntime').DirectoryEntry[]>;
  async readdir(_path: string, _options?: { withFileTypes?: boolean }): Promise<string[] | import('./JSRuntime').DirectoryEntry[]> {
    if (_options?.withFileTypes) {
      return [];
    }
    return [];
  }

  async mkdir(path: string, _options?: { recursive?: boolean }): Promise<void> {
    this.directories.add(path);
  }

  async stat(path: string) {
    if (this.files.has(path)) {
      return {
        isDirectory: () => false,
        isFile: () => true,
        size: 100,
        mtimeMs: Date.now()
      };
    }
    if (this.directories.has(path)) {
      return {
        isDirectory: () => true,
        isFile: () => false,
        size: 0,
        mtimeMs: Date.now()
      };
    }
    throw new Error(`File not found: ${path}`);
  }

  async lstat(path: string) {
    return this.stat(path);
  }

  async unlink(): Promise<void> {}
  async rmdir(): Promise<void> {}
  async rename(): Promise<void> {}
  async readlink(): Promise<string> { return ''; }
  async symlink(): Promise<void> {}
}

describe('fileUtils', () => {
  let mockFS: MockFS;

  beforeEach(() => {
    mockFS = new MockFS();
  });

  describe('generateUniqueFilename', () => {
    it('should return original filename if no conflict', async () => {
      const result = await generateUniqueFilename(mockFS, '/tmp', 'test.txt');
      expect(result).toBe('test.txt');
    });

    it('should add counter for conflicting filenames', async () => {
      // Simulate existing files
      await mockFS.writeFile('/tmp/test.txt', 'content');
      await mockFS.writeFile('/tmp/test_1.txt', 'content');

      const result = await generateUniqueFilename(mockFS, '/tmp', 'test.txt');
      expect(result).toBe('test_2.txt');
    });

    it('should handle files without extension', async () => {
      await mockFS.writeFile('/tmp/README', 'content');

      const result = await generateUniqueFilename(mockFS, '/tmp', 'README');
      expect(result).toBe('README_1');
    });

    it('should handle multiple extensions correctly', async () => {
      await mockFS.writeFile('/tmp/archive.tar.gz', 'content');

      const result = await generateUniqueFilename(mockFS, '/tmp', 'archive.tar.gz');
      expect(result).toBe('archive.tar_1.gz');
    });
  });

  describe('saveFileToTmp', () => {
    it('should save file to /tmp directory', async () => {
      const fileContent = 'Hello, world!';
      const arrayBuffer = new TextEncoder().encode(fileContent).buffer;

      // Create a mock File object with arrayBuffer method
      const file = {
        name: 'hello.txt',
        arrayBuffer: async () => arrayBuffer
      } as File;

      const savedPath = await saveFileToTmp(mockFS, file);

      expect(savedPath).toBe('/tmp/hello.txt');

      // Verify file was actually saved
      const savedContent = await mockFS.readFile('/tmp/hello.txt', 'utf8');
      expect(savedContent).toBe(fileContent);
    });

    it('should handle file deduplication', async () => {
      // Create existing file
      await mockFS.writeFile('/tmp/test.txt', 'existing');

      const fileContent = 'new content';
      const arrayBuffer = new TextEncoder().encode(fileContent).buffer;

      // Create a mock File object with arrayBuffer method
      const file = {
        name: 'test.txt',
        arrayBuffer: async () => arrayBuffer
      } as File;

      const savedPath = await saveFileToTmp(mockFS, file);

      expect(savedPath).toBe('/tmp/test_1.txt');

      // Verify new file was saved with unique name
      const savedContent = await mockFS.readFile('/tmp/test_1.txt', 'utf8');
      expect(savedContent).toBe(fileContent);
    });

    it('should convert spaces to underscores in filename', async () => {
      const fileContent = 'Hello, world!';
      const arrayBuffer = new TextEncoder().encode(fileContent).buffer;

      // Create a mock File object with spaces in the name
      const file = {
        name: 'my file with spaces.txt',
        arrayBuffer: async () => arrayBuffer
      } as File;

      const savedPath = await saveFileToTmp(mockFS, file);

      expect(savedPath).toBe('/tmp/my_file_with_spaces.txt');

      // Verify file was actually saved with sanitized name
      const savedContent = await mockFS.readFile('/tmp/my_file_with_spaces.txt', 'utf8');
      expect(savedContent).toBe(fileContent);
    });

    it('should convert multiple consecutive spaces to single underscore', async () => {
      const fileContent = 'test content';
      const arrayBuffer = new TextEncoder().encode(fileContent).buffer;

      // Create a mock File object with multiple spaces
      const file = {
        name: 'file   with    multiple spaces.txt',
        arrayBuffer: async () => arrayBuffer
      } as File;

      const savedPath = await saveFileToTmp(mockFS, file);

      expect(savedPath).toBe('/tmp/file_with_multiple_spaces.txt');

      // Verify file was actually saved
      const savedContent = await mockFS.readFile('/tmp/file_with_multiple_spaces.txt', 'utf8');
      expect(savedContent).toBe(fileContent);
    });
  });
});