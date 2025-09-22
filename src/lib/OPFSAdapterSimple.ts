import type { JSRuntimeFS, DirectoryEntry } from './JSRuntime';

/**
 * Simple OPFS (Origin Private File System) adapter that implements JSRuntimeFS interface
 * This version is designed to work with isomorphic-git with minimal interference
 */
export class OPFSAdapterSimple implements JSRuntimeFS {
  private root: Promise<FileSystemDirectoryHandle>;

  constructor() {
    // Check if OPFS is available
    if (!('storage' in navigator) ||
        typeof (navigator.storage as unknown as { getDirectory: () => Promise<FileSystemDirectoryHandle> }).getDirectory !== 'function') {
      throw new Error('OPFS is not supported in this browser or environment');
    }

    // Get the root directory handle for OPFS
    this.root = (navigator.storage as unknown as { getDirectory: () => Promise<FileSystemDirectoryHandle> }).getDirectory();
  }

  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, encoding: 'utf8'): Promise<string>;
  async readFile(path: string, encoding: string): Promise<string>;
  async readFile(path: string, encoding?: string): Promise<string | Uint8Array>;
  async readFile(path: string, encoding?: string): Promise<string | Uint8Array> {
    try {
      // Basic path validation
      if (!path || typeof path !== 'string') {
        const error = new Error('ENOENT: no such file or directory, open \'undefined\'') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        error.errno = -2;
        error.syscall = 'open';
        error.path = path || 'undefined';
        throw error;
      }

      const fileHandle = await this.getFileHandle(path);
      const file = await fileHandle.getFile();

      // Handle encoding parameter exactly like LightningFS
      if (encoding === 'utf8') {
        return await file.text();
      } else if (encoding) {
        // Any other encoding value, return as text
        return await file.text();
      } else {
        // No encoding or undefined, return as Uint8Array (binary data)
        const arrayBuffer = await file.arrayBuffer();
        return new Uint8Array(arrayBuffer);
      }
    } catch (error) {
      // Convert DOMException to Node.js style error for isomorphic-git compatibility
      if (error instanceof Error && (error.message.includes('NotFound') || error.name === 'NotFoundError')) {
        const nodeError = new Error(`ENOENT: no such file or directory, open '${path}'`) as NodeJS.ErrnoException;
        nodeError.code = 'ENOENT';
        nodeError.errno = -2;
        nodeError.syscall = 'open';
        nodeError.path = path;
        throw nodeError;
      }

      // For any other error, ensure it has the properties isomorphic-git expects
      if (error instanceof Error) {
        const nodeError = error as NodeJS.ErrnoException;
        // If it doesn't have the expected properties, add them
        if (!nodeError.code) {
          nodeError.code = 'UNKNOWN';
        }
        if (!nodeError.errno) {
          nodeError.errno = -1;
        }
        if (!nodeError.syscall) {
          nodeError.syscall = 'read';
        }
        if (!nodeError.path) {
          nodeError.path = path;
        }
      }

      throw error;
    }
  }

  async writeFile(path: string, data: string | Uint8Array, _encoding?: string): Promise<void> {
    const fileHandle = await this.getFileHandle(path, { create: true });
    const writable = await fileHandle.createWritable();

    if (typeof data === 'string') {
      await writable.write(data);
    } else {
      await writable.write(data);
    }

    await writable.close();
  }

  async readdir(path: string): Promise<string[]>;
  async readdir(path: string, options: { withFileTypes: true }): Promise<DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]> {
    try {
      const dirHandle = await this.getDirectoryHandle(path);
      const entries: string[] = [];
      const directoryEntries: DirectoryEntry[] = [];

      // Use asyncIterator to iterate through directory entries
      const dirIterator = (dirHandle as unknown as { values: () => AsyncIterableIterator<FileSystemHandle> }).values();
      let result = await dirIterator.next();

      while (!result.done) {
        const entry = result.value;
        if (options?.withFileTypes) {
          directoryEntries.push({
            name: entry.name,
            isDirectory: () => entry.kind === 'directory',
            isFile: () => entry.kind === 'file',
          });
        } else {
          entries.push(entry.name);
        }
        result = await dirIterator.next();
      }

      return options?.withFileTypes ? directoryEntries : entries;
    } catch (error) {
      // Convert DOMException to Node.js style error for isomorphic-git compatibility
      if (error instanceof Error && (error.message.includes('NotFound') || error.name === 'NotFoundError')) {
        const nodeError = new Error(`ENOENT: no such file or directory, scandir '${path}'`) as NodeJS.ErrnoException;
        nodeError.code = 'ENOENT';
        nodeError.errno = -2;
        nodeError.syscall = 'scandir';
        nodeError.path = path;
        throw nodeError;
      }
      throw error;
    }
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    try {
      if (options?.recursive) {
        await this.createDirectoriesRecursive(path);
      } else {
        const parentPath = this.getParentPath(path);
        const dirName = this.getBaseName(path);
        const parentHandle = await this.getDirectoryHandle(parentPath);
        await parentHandle.getDirectoryHandle(dirName, { create: true });
      }
    } catch (error) {
      if (error instanceof Error && (error.message.includes('NotFound') || error.name === 'NotFoundError')) {
        throw new Error('ENOENT: no such file or directory');
      }
      throw error;
    }
  }

  async stat(path: string): Promise<{
    isDirectory(): boolean;
    size?: number;
    mtimeMs?: number;
    isFile(): boolean;
  }> {
    // Basic path validation
    if (!path || typeof path !== 'string') {
      throw new Error('ENOENT: no such file or directory');
    }

    try {
      const fileHandle = await this.getFileHandle(path);
      const file = await fileHandle.getFile();

      // Check if this is a Git symlink file
      // Git symlinks are small files that contain target paths
      // We'll consider files < 1024 bytes that don't contain null bytes as potential symlinks
      // const isSymlink = file.size < 1024 && file.size > 0;

      return {
        isDirectory: () => false,
        isFile: () => true,
        // isSymbolicLink: () => isSymlink,
        size: file.size,
        mtimeMs: file.lastModified,
      };
    } catch {
      // If not a file, try as directory
      try {
        await this.getDirectoryHandle(path);
        return {
          isDirectory: () => true,
          isFile: () => false,
          // isSymbolicLink: () => false,
        };
      } catch (dirError) {
        // Convert DOMException to Node.js style error for isomorphic-git compatibility
        if (dirError instanceof Error && (dirError.message.includes('NotFound') || dirError.name === 'NotFoundError')) {
          const nodeError = new Error(`ENOENT: no such file or directory, stat '${path}'`) as NodeJS.ErrnoException;
          nodeError.code = 'ENOENT';
          nodeError.errno = -2;
          nodeError.syscall = 'stat';
          nodeError.path = path;
          throw nodeError;
        }
        throw dirError;
      }
    }
  }

  async lstat(path: string): Promise<{
    isDirectory(): boolean;
    isFile(): boolean;
    size?: number;
    mtimeMs?: number;
  }> {
    // OPFS doesn't have real symbolic links, but we emulate them for Git
    // lstat should behave the same as stat in our emulation
    return this.stat(path);
  }

  async unlink(path: string): Promise<void> {
    const parentPath = this.getParentPath(path);
    const fileName = this.getBaseName(path);
    const parentHandle = await this.getDirectoryHandle(parentPath);
    await parentHandle.removeEntry(fileName);
  }

  async rmdir(path: string): Promise<void> {
    const parentPath = this.getParentPath(path);
    const dirName = this.getBaseName(path);
    const parentHandle = await this.getDirectoryHandle(parentPath);
    await parentHandle.removeEntry(dirName, { recursive: true });
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    // OPFS doesn't have a native rename operation, so we need to copy and delete
    await this.copyRecursive(oldPath, newPath);
    await this.unlinkRecursive(oldPath);
  }

  async readlink(path: string): Promise<string> {
    try {
      // Basic path validation
      if (!path || typeof path !== 'string') {
        throw new Error('ENOENT: no such file or directory');
      }

      // OPFS doesn't support real symlinks, but Git uses them for .git/HEAD and refs
      // We emulate symlinks by storing the target as file content
      const fileHandle = await this.getFileHandle(path);
      const file = await fileHandle.getFile();
      const content = await file.text();

      // Git symlink files contain the target path
      // Remove any trailing newlines and return the target
      return content.trim();
    } catch (error) {
      // Convert DOMException to Node.js style error for isomorphic-git compatibility
      if (error instanceof Error && (error.message.includes('NotFound') || error.name === 'NotFoundError')) {
        const nodeError = new Error(`ENOENT: no such file or directory, readlink '${path}'`) as NodeJS.ErrnoException;
        nodeError.code = 'ENOENT';
        nodeError.errno = -2;
        nodeError.syscall = 'readlink';
        nodeError.path = path;
        throw nodeError;
      }

      // For any other error, ensure it has properties isomorphic-git expects
      if (error instanceof Error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (!nodeError.code) {
          nodeError.code = 'UNKNOWN';
        }
        if (!nodeError.errno) {
          nodeError.errno = -1;
        }
        if (!nodeError.syscall) {
          nodeError.syscall = 'readlink';
        }
        if (!nodeError.path) {
          nodeError.path = path;
        }
      }

      throw error;
    }
  }

  async symlink(target: string, path: string): Promise<void> {
    try {
      // Basic path validation
      if (!path || typeof path !== 'string') {
        throw new Error('ENOENT: no such file or directory');
      }

      // OPFS doesn't support real symlinks, but we can emulate them
      // by writing the target as file content (this is how Git stores symlinks)
      const fileHandle = await this.getFileHandle(path, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(target);
      await writable.close();
    } catch (error) {
      // Convert DOMException to Node.js style error for isomorphic-git compatibility
      if (error instanceof Error && (error.message.includes('NotFound') || error.name === 'NotFoundError')) {
        const nodeError = new Error(`ENOENT: no such file or directory, symlink '${path}'`) as NodeJS.ErrnoException;
        nodeError.code = 'ENOENT';
        nodeError.errno = -2;
        nodeError.syscall = 'symlink';
        nodeError.path = path;
        throw nodeError;
      }

      // For any other error, ensure it has properties isomorphic-git expects
      if (error instanceof Error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (!nodeError.code) {
          nodeError.code = 'UNKNOWN';
        }
        if (!nodeError.errno) {
          nodeError.errno = -1;
        }
        if (!nodeError.syscall) {
          nodeError.syscall = 'symlink';
        }
        if (!nodeError.path) {
          nodeError.path = path;
        }
      }

      throw error;
    }
  }

  // Helper methods
  private async getDirectoryHandle(path: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle> {
    if (path === '/' || path === '') {
      return this.root;
    }

    // Basic path validation
    if (!path || typeof path !== 'string') {
      throw new Error('ENOENT: no such file or directory');
    }

    const parts = path.split('/').filter(Boolean);
    let currentHandle = await this.root;

    for (const part of parts) {
      try {
        currentHandle = await currentHandle.getDirectoryHandle(part, options);
      } catch (error) {
        // Convert DOMException to Node.js style error for better compatibility
        if (error instanceof Error && (error.message.includes('NotFound') || error.name === 'NotFoundError')) {
          if (options?.create) {
            // If we're supposed to create, this shouldn't happen, but re-throw with better error
            throw new Error(`Failed to create directory part '${part}' in path '${path}': ${error.message}`);
          } else {
            // Directory doesn't exist and we're not creating it
            const nodeError = new Error(`ENOENT: no such file or directory, stat '${path}'`) as NodeJS.ErrnoException;
            nodeError.code = 'ENOENT';
            nodeError.errno = -2;
            nodeError.syscall = 'stat';
            nodeError.path = path;
            throw nodeError;
          }
        }
        throw error;
      }
    }

    return currentHandle;
  }

  private async getFileHandle(path: string, options?: { create?: boolean }): Promise<FileSystemFileHandle> {
    // Basic path validation
    if (!path || typeof path !== 'string') {
      throw new Error('ENOENT: no such file or directory');
    }

    const parentPath = this.getParentPath(path);
    const fileName = this.getBaseName(path);
    const parentHandle = await this.getDirectoryHandle(parentPath);
    return parentHandle.getFileHandle(fileName, options);
  }

  private getParentPath(path: string): string {
    const parts = path.split('/').filter(Boolean);
    parts.pop(); // Remove the last part
    return parts.length > 0 ? `/${parts.join('/')}` : '/';
  }

  private getBaseName(path: string): string {
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  }

  private async createDirectoriesRecursive(path: string): Promise<void> {
    const parts = path.split('/').filter(Boolean);
    let currentHandle = await this.root;

    for (const part of parts) {
      currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
    }
  }

  private async copyRecursive(source: string, destination: string): Promise<void> {
    const sourceStat = await this.stat(source);

    if (sourceStat.isFile()) {
      // Copy file
      const sourceHandle = await this.getFileHandle(source);
      const file = await sourceHandle.getFile();
      const destHandle = await this.getFileHandle(destination, { create: true });
      const writable = await destHandle.createWritable();
      await writable.write(file);
      await writable.close();
    } else if (sourceStat.isDirectory()) {
      // Copy directory
      await this.mkdir(destination, { recursive: true });
      const entries = await this.readdir(source);

      for (const entry of entries) {
        const sourceEntry = source === '/' ? `/${entry}` : `${source}/${entry}`;
        const destEntry = destination === '/' ? `/${entry}` : `${destination}/${entry}`;
        await this.copyRecursive(sourceEntry, destEntry);
      }
    }
  }

  private async unlinkRecursive(path: string): Promise<void> {
    const stat = await this.stat(path);

    if (stat.isFile()) {
      await this.unlink(path);
    } else if (stat.isDirectory()) {
      const entries = await this.readdir(path);

      for (const entry of entries) {
        const entryPath = path === '/' ? `/${entry}` : `${path}/${entry}`;
        await this.unlinkRecursive(entryPath);
      }

      // Remove the directory itself
      const parentPath = this.getParentPath(path);
      const dirName = this.getBaseName(path);
      const parentHandle = await this.getDirectoryHandle(parentPath);
      await parentHandle.removeEntry(dirName);
    }
  }
}