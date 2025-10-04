import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cleanupTmpDirectory } from './tmpCleanup';
import type { JSRuntimeFS } from './JSRuntime';

// Mock filesystem implementation for testing
class MockFS implements JSRuntimeFS {
  protected files = new Map<string, { content: string | Uint8Array; mtimeMs: number; isDir: boolean }>();

  constructor() {
    // Initialize with /tmp directory
    this.files.set('/tmp', { content: '', mtimeMs: Date.now(), isDir: true });
  }

  addFile(path: string, content: string, ageMs = 0) {
    const mtimeMs = Date.now() - ageMs;
    this.files.set(path, { content, mtimeMs, isDir: false });
  }

  addDirectory(path: string, ageMs = 0) {
    const mtimeMs = Date.now() - ageMs;
    this.files.set(path, { content: '', mtimeMs, isDir: true });
  }

  hasFile(path: string): boolean {
    return this.files.has(path);
  }

  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, options: 'utf8'): Promise<string>;
  async readFile(path: string, options: string): Promise<string>;
  async readFile(path: string, options: { encoding: 'utf8' }): Promise<string>;
  async readFile(path: string, options: { encoding: string }): Promise<string>;
  async readFile(path: string, options?: string | { encoding?: string }): Promise<string | Uint8Array>;
  async readFile(path: string, options?: string | { encoding?: string }): Promise<string | Uint8Array> {
    const file = this.files.get(path);
    if (!file || file.isDir) throw new Error(`File not found: ${path}`);
    const encoding = typeof options === 'string' ? options : options?.encoding;
    return encoding === 'utf8' ? file.content.toString() : new Uint8Array();
  }

  async writeFile(path: string, data: string | Uint8Array, _options?: string | { encoding?: string }): Promise<void> {
    this.files.set(path, { content: data, mtimeMs: Date.now(), isDir: false });
  }

  async readdir(path: string): Promise<string[]>;
  async readdir(path: string, options: { withFileTypes: true }): Promise<Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>> {
    const entries: string[] = [];
    const prefix = path === '/' ? '/' : `${path}/`;

    for (const [filePath] of this.files) {
      if (filePath.startsWith(prefix) && filePath !== path) {
        const relativePath = filePath.slice(prefix.length);
        const name = relativePath.split('/')[0];
        if (name && !entries.includes(name)) {
          entries.push(name);
        }
      }
    }

    if (options?.withFileTypes) {
      return entries.map(name => {
        const fullPath = path === '/' ? `/${name}` : `${path}/${name}`;
        const file = this.files.get(fullPath);
        return {
          name,
          isDirectory: () => file?.isDir || false,
          isFile: () => !file?.isDir || false,
        };
      });
    }

    return entries;
  }

  async mkdir(path: string): Promise<void> {
    this.files.set(path, { content: '', mtimeMs: Date.now(), isDir: true });
  }

  async stat(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean; mtimeMs?: number }> {
    const file = this.files.get(path);
    if (!file) throw new Error(`File not found: ${path}`);

    return {
      isDirectory: () => file.isDir,
      isFile: () => !file.isDir,
      mtimeMs: file.mtimeMs,
    };
  }

  async lstat(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean; mtimeMs?: number }> {
    return this.stat(path);
  }

  async unlink(path: string): Promise<void> {
    const file = this.files.get(path);
    if (!file || file.isDir) throw new Error(`File not found: ${path}`);
    this.files.delete(path);
  }

  async rmdir(path: string): Promise<void> {
    const file = this.files.get(path);
    if (!file || !file.isDir) throw new Error(`Directory not found: ${path}`);

    // Check if directory is empty
    const prefix = `${path}/`;
    for (const [filePath] of this.files) {
      if (filePath.startsWith(prefix)) {
        throw new Error(`Directory not empty: ${path}`);
      }
    }

    this.files.delete(path);
  }

  async rename(): Promise<void> { throw new Error('Not implemented'); }
  async readlink(): Promise<string> { throw new Error('Not implemented'); }
  async symlink(): Promise<void> { throw new Error('Not implemented'); }
}

describe('tmpCleanup', () => {
  let mockFS: MockFS;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockFS = new MockFS();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should remove files older than 1 hour', async () => {
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const TWO_HOURS_MS = 2 * ONE_HOUR_MS;

    // Add files with different ages
    mockFS.addFile('/tmp/old-file.txt', 'old content', TWO_HOURS_MS);
    mockFS.addFile('/tmp/new-file.txt', 'new content', 30 * 60 * 1000); // 30 minutes old

    expect(mockFS.hasFile('/tmp/old-file.txt')).toBe(true);
    expect(mockFS.hasFile('/tmp/new-file.txt')).toBe(true);

    await cleanupTmpDirectory(mockFS);

    // Old file should be removed, new file should remain
    expect(mockFS.hasFile('/tmp/old-file.txt')).toBe(false);
    expect(mockFS.hasFile('/tmp/new-file.txt')).toBe(true);
  });

  it('should remove empty directories older than 1 hour', async () => {
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

    // Add an old empty directory
    mockFS.addDirectory('/tmp/old-dir', TWO_HOURS_MS);

    expect(mockFS.hasFile('/tmp/old-dir')).toBe(true);

    await cleanupTmpDirectory(mockFS);

    // Old directory should be removed
    expect(mockFS.hasFile('/tmp/old-dir')).toBe(false);
  });

  it('should recursively clean subdirectories', async () => {
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

    // Add nested structure with old files
    mockFS.addDirectory('/tmp/subdir', TWO_HOURS_MS);
    mockFS.addFile('/tmp/subdir/old-file.txt', 'old content', TWO_HOURS_MS);
    mockFS.addDirectory('/tmp/subdir/nested', TWO_HOURS_MS);
    mockFS.addFile('/tmp/subdir/nested/another-old-file.txt', 'old content', TWO_HOURS_MS);

    expect(mockFS.hasFile('/tmp/subdir/old-file.txt')).toBe(true);
    expect(mockFS.hasFile('/tmp/subdir/nested/another-old-file.txt')).toBe(true);

    await cleanupTmpDirectory(mockFS);

    // All old files and directories should be removed
    expect(mockFS.hasFile('/tmp/subdir/old-file.txt')).toBe(false);
    expect(mockFS.hasFile('/tmp/subdir/nested/another-old-file.txt')).toBe(false);
    expect(mockFS.hasFile('/tmp/subdir/nested')).toBe(false);
    expect(mockFS.hasFile('/tmp/subdir')).toBe(false);
  });

  it('should preserve new files in old directories', async () => {
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const THIRTY_MINUTES_MS = 30 * 60 * 1000;

    // Add old directory with new file
    mockFS.addDirectory('/tmp/old-dir', TWO_HOURS_MS);
    mockFS.addFile('/tmp/old-dir/new-file.txt', 'new content', THIRTY_MINUTES_MS);

    expect(mockFS.hasFile('/tmp/old-dir')).toBe(true);
    expect(mockFS.hasFile('/tmp/old-dir/new-file.txt')).toBe(true);

    await cleanupTmpDirectory(mockFS);

    // New file should remain, directory should remain because it's not empty
    expect(mockFS.hasFile('/tmp/old-dir/new-file.txt')).toBe(true);
    expect(mockFS.hasFile('/tmp/old-dir')).toBe(true);
  });

  it('should handle missing /tmp directory gracefully', async () => {
    // Create a fresh mock without /tmp
    const emptyFS = new (class extends MockFS {
      constructor() {
        super();
        this.files.clear(); // Remove the default /tmp directory
      }
    })();

    // Should not throw an error
    await expect(cleanupTmpDirectory(emptyFS)).resolves.toBeUndefined();
  });

  it('should log cleanup actions', async () => {
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

    mockFS.addFile('/tmp/old-file.txt', 'old content', TWO_HOURS_MS);

    await cleanupTmpDirectory(mockFS);

    expect(consoleSpy).toHaveBeenCalledWith('Starting /tmp directory cleanup...');
    expect(consoleSpy).toHaveBeenCalledWith('Removed old file: /tmp/old-file.txt');
    expect(consoleSpy).toHaveBeenCalledWith('Completed /tmp directory cleanup');
  });
});