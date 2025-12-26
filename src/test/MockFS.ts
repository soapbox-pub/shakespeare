import type { JSRuntimeFS, DirectoryEntry } from '@/lib/JSRuntime';

/**
 * Minimal mock filesystem implementation for testing
 * Implements only the essential methods needed by isomorphic-git
 */
export class MockFS implements JSRuntimeFS {
  private files: Map<string, string | Uint8Array> = new Map();
  private dirs: Set<string> = new Set(['/']);

  // Expose promises property for isomorphic-git compatibility
  promises = this;

  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, options: 'utf8'): Promise<string>;
  async readFile(path: string, options: string): Promise<string>;
  async readFile(path: string, options: { encoding: 'utf8' }): Promise<string>;
  async readFile(path: string, options: { encoding: string }): Promise<string>;
  async readFile(path: string, options?: string | { encoding?: string }): Promise<string | Uint8Array>;
  async readFile(path: string, options?: string | { encoding?: string }): Promise<string | Uint8Array> {
    const content = this.files.get(path);
    if (content === undefined) {
      const error = new Error(`ENOENT: no such file or directory, open '${path}'`) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
    const encoding = typeof options === 'string' ? options : options?.encoding;
    if (encoding === 'utf8') {
      if (typeof content === 'string') return content;
      return new TextDecoder('utf-8').decode(content as Uint8Array);
    }
    if (typeof content === 'string') return new TextEncoder().encode(content);
    return content as Uint8Array;
  }

  async writeFile(path: string, data: string | Uint8Array): Promise<void> {
    this.files.set(path, data);
    const dir = path.split('/').slice(0, -1).join('/') || '/';
    this.dirs.add(dir);
  }

  readdir(path: string): Promise<string[]>;
  readdir(path: string, options: { withFileTypes: true }): Promise<DirectoryEntry[]>;
  readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]> {
    if (!this.dirs.has(path)) {
      const error = new Error(`ENOENT: no such file or directory, scandir '${path}'`) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }

    const entries: string[] = [];
    const searchPrefix = path === '/' ? '/' : path + '/';
    const prefixLength = path === '/' ? 1 : path.length + 1;

    for (const dir of this.dirs) {
      if (dir !== path && dir.startsWith(searchPrefix)) {
        const relativePath = dir.slice(prefixLength);
        if (!relativePath.includes('/')) {
          entries.push(relativePath);
        }
      }
    }
    for (const file of this.files.keys()) {
      if (file.startsWith(searchPrefix)) {
        const relativePath = file.slice(prefixLength);
        if (!relativePath.includes('/')) {
          entries.push(relativePath);
        }
      }
    }

    const uniqueEntries = [...new Set(entries)];
    if (options?.withFileTypes) {
      return uniqueEntries.map(name => {
        const fullPath = path.endsWith('/') ? path + name : path + '/' + name;
        const isDir = this.dirs.has(fullPath);
        return {
          name,
          isDirectory: () => isDir,
          isFile: () => !isDir,
          isSymbolicLink: () => false,
        } as unknown as DirectoryEntry;
      });
    }
    return uniqueEntries;
  }

  async mkdir(path: string): Promise<void> {
    this.dirs.add(path);
  }

  async stat(path: string): Promise<{
    isDirectory(): boolean;
    isFile(): boolean;
    isSymbolicLink(): boolean;
    mtimeMs?: number;
    mtime?: Date;
    ctimeMs?: number;
    ctime?: Date;
    mode?: number;
    size?: number;
    ino?: number;
    uid?: number;
    gid?: number;
  }> {
    const now = new Date();
    const nowMs = now.getTime();
    if (this.dirs.has(path)) {
      return {
        isDirectory: () => true,
        isFile: () => false,
        isSymbolicLink: () => false,
        mtimeMs: nowMs,
        mtime: now,
        ctimeMs: nowMs,
        ctime: now,
        mode: 0o40755,
        size: 0,
        ino: 1,
        uid: 1000,
        gid: 1000,
      };
    }
    if (this.files.has(path)) {
      const content = this.files.get(path)!;
      const size = typeof content === 'string' ? content.length : content.byteLength;
      return {
        isDirectory: () => false,
        isFile: () => true,
        isSymbolicLink: () => false,
        mtimeMs: nowMs,
        mtime: now,
        ctimeMs: nowMs,
        ctime: now,
        mode: 0o100644,
        size,
        ino: 1,
        uid: 1000,
        gid: 1000,
      };
    }
    const error = new Error(`ENOENT: no such file or directory, stat '${path}'`) as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    throw error;
  }

  async lstat(path: string): Promise<{
    isDirectory(): boolean;
    isFile(): boolean;
    isSymbolicLink(): boolean;
    mtimeMs?: number;
    mtime?: Date;
    ctimeMs?: number;
    ctime?: Date;
    mode?: number;
    size?: number;
    ino?: number;
    uid?: number;
    gid?: number;
  }> {
    return this.stat(path);
  }

  async readlink(_path: string): Promise<string> {
    const error = new Error('EINVAL: invalid argument') as NodeJS.ErrnoException;
    error.code = 'EINVAL';
    throw error;
  }

  async symlink(_target: string, _path: string): Promise<void> {
    // No-op for mock
  }

  async unlink(path: string): Promise<void> {
    this.files.delete(path);
  }

  async rmdir(path: string): Promise<void> {
    this.dirs.delete(path);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    if (this.files.has(oldPath)) {
      const content = this.files.get(oldPath);
      this.files.delete(oldPath);
      this.files.set(newPath, content!);
    }
    if (this.dirs.has(oldPath)) {
      this.dirs.delete(oldPath);
      this.dirs.add(newPath);
    }
  }

  async chmod(_path: string, _mode: number): Promise<void> {
    // No-op for mock
  }

  async rm(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (options?.recursive) {
      for (const file of [...this.files.keys()]) {
        if (file.startsWith(path + '/') || file === path) this.files.delete(file);
      }
      for (const dir of [...this.dirs]) {
        if (dir.startsWith(path + '/') || dir === path) this.dirs.delete(dir);
      }
    } else {
      await this.unlink(path);
    }
  }
}
