import { describe, it, expect, beforeEach } from 'vitest';
import type { JSRuntimeFS } from './JSRuntime';
import { getPlugins } from './plugins';

// Mock filesystem for testing
class MockFS implements JSRuntimeFS {
  private files: Map<string, string | Uint8Array> = new Map();
  private dirs: Set<string> = new Set();

  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, options: 'utf8'): Promise<string>;
  async readFile(path: string, options: string): Promise<string>;
  async readFile(path: string, options: { encoding: 'utf8' }): Promise<string>;
  async readFile(path: string, options: { encoding: string }): Promise<string>;
  async readFile(path: string, options?: string | { encoding?: string }): Promise<string | Uint8Array>;
  async readFile(path: string, options?: string | { encoding?: string }): Promise<string | Uint8Array> {
    const content = this.files.get(path);
    if (!content) throw new Error(`ENOENT: ${path}`);

    const encoding = typeof options === 'string' ? options : options?.encoding;
    if (encoding === 'utf8') {
      return typeof content === 'string' ? content : new TextDecoder().decode(content);
    }
    return typeof content === 'string' ? new TextEncoder().encode(content) : content;
  }

  async writeFile(path: string, data: string | Uint8Array): Promise<void> {
    this.files.set(path, data);
    // Auto-create parent directories
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
      this.dirs.add(parts.slice(0, i).join('/') || '/');
    }
  }

  async readdir(path: string): Promise<string[]>;
  async readdir(path: string, options: { withFileTypes: true }): Promise<import('./JSRuntime').DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | import('./JSRuntime').DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | import('./JSRuntime').DirectoryEntry[]> {
    if (!this.dirs.has(path)) throw new Error(`ENOENT: ${path}`);

    const entries = new Set<string>();
    const prefix = path === '/' ? '/' : path + '/';

    // Check files
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(prefix)) {
        const relativePath = filePath.slice(prefix.length);
        const firstPart = relativePath.split('/')[0];
        if (firstPart) entries.add(firstPart);
      }
    }

    // Check directories
    for (const dirPath of this.dirs) {
      if (dirPath.startsWith(prefix) && dirPath !== path) {
        const relativePath = dirPath.slice(prefix.length);
        const firstPart = relativePath.split('/')[0];
        if (firstPart) entries.add(firstPart);
      }
    }

    const names = Array.from(entries);

    if (options?.withFileTypes) {
      return names.map(name => {
        const fullPath = path === '/' ? `/${name}` : `${path}/${name}`;
        const isDir = this.dirs.has(fullPath);
        return {
          name,
          isDirectory: () => isDir,
          isFile: () => !isDir,
        };
      });
    }

    return names;
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (options?.recursive) {
      const parts = path.split('/');
      for (let i = 1; i <= parts.length; i++) {
        const dir = parts.slice(0, i).join('/') || '/';
        this.dirs.add(dir);
      }
    } else {
      this.dirs.add(path);
    }
  }

  async stat(path: string): Promise<{ isDirectory: () => boolean; isFile: () => boolean }> {
    const isDir = this.dirs.has(path);
    const isFile = this.files.has(path);

    if (!isDir && !isFile) throw new Error(`ENOENT: ${path}`);

    return {
      isDirectory: () => isDir,
      isFile: () => isFile,
    };
  }

  async rm(path: string, options?: { recursive?: boolean }): Promise<void> {
    this.files.delete(path);
    this.dirs.delete(path);

    if (options?.recursive) {
      const prefix = path + '/';
      for (const filePath of Array.from(this.files.keys())) {
        if (filePath.startsWith(prefix)) {
          this.files.delete(filePath);
        }
      }
      for (const dirPath of Array.from(this.dirs)) {
        if (dirPath.startsWith(prefix)) {
          this.dirs.delete(dirPath);
        }
      }
    }
  }

  async rmdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    return this.rm(path, options);
  }

  async unlink(path: string): Promise<void> {
    this.files.delete(path);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const content = this.files.get(oldPath);
    if (content) {
      this.files.set(newPath, content);
      this.files.delete(oldPath);
    }
  }

  async lstat(path: string): Promise<{ isDirectory: () => boolean; isFile: () => boolean }> {
    return this.stat(path);
  }

  async readlink(_path: string): Promise<string> {
    throw new Error('Symlinks not supported in MockFS');
  }

  async symlink(_target: string, _path: string): Promise<void> {
    throw new Error('Symlinks not supported in MockFS');
  }
}

describe('plugins', () => {
  let fs: MockFS;

  beforeEach(() => {
    fs = new MockFS();
  });

  describe('getPlugins', () => {
    it('should return empty array when plugins directory does not exist', async () => {
      const plugins = await getPlugins(fs, '/plugins');
      expect(plugins).toEqual([]);
    });

    it('should return list of plugin directories', async () => {
      await fs.mkdir('/plugins/plugin1', { recursive: true });
      await fs.mkdir('/plugins/plugin2', { recursive: true });
      await fs.writeFile('/plugins/file.txt', 'not a directory');

      const plugins = await getPlugins(fs, '/plugins');
      expect(plugins).toContain('plugin1');
      expect(plugins).toContain('plugin2');
      expect(plugins).not.toContain('file.txt');
    });
  });
});
