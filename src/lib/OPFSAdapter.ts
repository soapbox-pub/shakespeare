import type { JSRuntimeFS, DirectoryEntry } from './JSRuntime';

/**
 * OPFS (Origin Private File System) adapter that implements JSRuntimeFS interface
 * This makes OPFS compatible with the unified filesystem interface
 */
export class OPFSAdapter implements JSRuntimeFS {
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

  /**
   * Special method to handle Git-specific read operations more robustly
   * This helps with isomorphic-git compatibility
   */
  private async readFileForGit(path: string): Promise<Uint8Array> {
    try {
      // Guard against undefined path
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
      const arrayBuffer = await file.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      // Enhanced error handling for Git operations
      console.error(`Git read operation failed for path: ${path}`, error);

      // Create a more detailed error that isomorphic-git can handle
      const gitError = new Error(`ENOENT: no such file or directory, open '${path}'`) as NodeJS.ErrnoException;
      gitError.code = 'ENOENT';
      gitError.errno = -2;
      gitError.syscall = 'open';
      gitError.path = path;

      // Preserve original error information by adding it to the message
      if (error instanceof Error) {
        gitError.message = `${gitError.message}: ${error.message}`;
      }

      throw gitError;
    }
  }

  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, encoding: 'utf8'): Promise<string>;
  async readFile(path: string, encoding: string): Promise<string>;
  async readFile(path: string, encoding?: string): Promise<string | Uint8Array>;
  async readFile(path: string, encoding?: string): Promise<string | Uint8Array> {
    try {
      // Debug logging to see what's being called
      console.log(`OPFSAdapter.readFile called with path:`, path, `encoding:`, encoding);

      // Simple path validation like LightningFS
      if (!path || typeof path !== 'string') {
        throw new Error('ENOENT: no such file or directory');
      }

      // Use special Git handling for Git object files
      if (path.includes('.git/objects/') || path.includes('.git/')) {
        return await this.readFileForGit(path);
      }

      const fileHandle = await this.getFileHandle(path);
      const file = await fileHandle.getFile();

      if (encoding === 'utf8') {
        const text = await file.text();
        return text;
      } else if (encoding) {
        // For other encodings, we might need additional handling
        const text = await file.text();
        return text;
      } else {
        // Return as Uint8Array by default
        const arrayBuffer = await file.arrayBuffer();
        return new Uint8Array(arrayBuffer);
      }
    } catch (error) {
      console.error(`OPFSAdapter.readFile failed for path: ${path}`, error);

      // Convert to Node.js style error for consistency
      if (error instanceof Error && (error.message.includes('NotFound') || error.name === 'NotFoundError')) {
        const nodeError = new Error(`ENOENT: no such file or directory, open '${path}'`) as NodeJS.ErrnoException;
        nodeError.code = 'ENOENT';
        nodeError.errno = -2;
        nodeError.syscall = 'open';
        nodeError.path = path;
        throw nodeError;
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
      console.log(`OPFSAdapter.readdir called with path:`, path, `options:`, options);
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
      console.error(`OPFSAdapter.readdir failed for path: ${path}`, error);
      throw error;
    }
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    try {
    console.log(`OPFSAdapter.mkdir called with path:`, path, `options:`, options);

      // Guard against undefined path
      if (!path || typeof path !== 'string') {
        const error = new Error('ENOENT: no such file or directory, mkdir \'undefined\'') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        error.errno = -2;
        error.syscall = 'mkdir';
        error.path = path || 'undefined';
        throw error;
      }

      if (options?.recursive) {
        await this.createDirectoriesRecursive(path);
      } else {
        const parentPath = this.getParentPath(path);
        const dirName = this.getBaseName(path);
        const parentHandle = await this.getDirectoryHandle(parentPath);
        await parentHandle.getDirectoryHandle(dirName, { create: true });
      }
    } catch (error) {
      console.error(`OPFSAdapter.mkdir failed for path: ${path}`, error);

      // Convert to Node.js style error for consistency
      let mkdirError: NodeJS.ErrnoException;

      if (error instanceof Error && (error.message.includes('NotFound') || error.name === 'NotFoundError')) {
        // Parent directory doesn't exist
        mkdirError = new Error(`ENOENT: no such file or directory, mkdir '${path}'`) as NodeJS.ErrnoException;
        mkdirError.code = 'ENOENT';
        mkdirError.errno = -2;
      } else {
        // Other errors
        mkdirError = new Error(`EACCES: permission denied, mkdir '${path}'`) as NodeJS.ErrnoException;
        mkdirError.code = 'EACCES';
        mkdirError.errno = -13;
      }

      mkdirError.syscall = 'mkdir';
      mkdirError.path = path;

      // Preserve original error information by adding it to the message
      if (error instanceof Error) {
        mkdirError.message = `${mkdirError.message}: ${error.message}`;
      }

      throw mkdirError;
    }
  }

  async stat(path: string): Promise<{
    isDirectory(): boolean;
    isFile(): boolean;
    size?: number;
    mtimeMs?: number;
  }> {
    try {
      console.log(`OPFSAdapter.stat called with path:`, path);
      const fileHandle = await this.getFileHandle(path);
      const file = await fileHandle.getFile();

      return {
        isDirectory: () => false,
        isFile: () => true,
        size: file.size,
        mtimeMs: file.lastModified,
      };
    } catch (fileError) {
      // If not a file, try as directory
      try {
        await this.getDirectoryHandle(path);
        return {
          isDirectory: () => true,
          isFile: () => false,
        };
      } catch (dirError) {
        // Throw ENOENT error to match Node.js fs convention
        const error = new Error(`ENOENT: no such file or directory, stat '${path}'`) as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        error.errno = -2;
        error.syscall = 'stat';
        error.path = path;
        console.error(`OPFSAdapter.stat failed for path: ${path}`, { fileError, dirError });
        throw error;
      }
    }
  }

  async lstat(path: string): Promise<{
    isDirectory(): boolean;
    isFile(): boolean;
    size?: number;
    mtimeMs?: number;
  }> {
    // OPFS doesn't have symbolic links, so lstat is the same as stat
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

  async readlink(_path: string): Promise<string> {
    // OPFS doesn't support symbolic links
    throw new Error('Symbolic links are not supported in OPFS');
  }

  async symlink(_target: string, _path: string): Promise<void> {
    // OPFS doesn't support symbolic links
    throw new Error('Symbolic links are not supported in OPFS');
  }

  // Helper methods
  private async getDirectoryHandle(path: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle> {
    if (path === '/' || path === '') {
      return this.root;
    }

    const parts = path.split('/').filter(Boolean);
    let currentHandle = await this.root;

    for (const part of parts) {
      try {
        currentHandle = await currentHandle.getDirectoryHandle(part, options);
      } catch (error) {
        if (!options?.create) {
          // Convert OPFS error to ENOENT for consistency
          const errorWithCode = new Error(`ENOENT: no such file or directory, scandir '${path}'`) as NodeJS.ErrnoException;
          errorWithCode.code = 'ENOENT';
          errorWithCode.errno = -2;
          errorWithCode.syscall = 'scandir';
          errorWithCode.path = path;
          throw errorWithCode;
        }
        throw error;
      }
    }

    return currentHandle;
  }

  private async getFileHandle(path: string, options?: { create?: boolean }): Promise<FileSystemFileHandle> {
    // Guard against undefined path
    if (!path || typeof path !== 'string') {
      const error = new Error('ENOENT: no such file or directory, open \'undefined\'') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      error.errno = -2;
      error.syscall = 'open';
      error.path = path || 'undefined';
      throw error;
    }

    const parentPath = this.getParentPath(path);
    const fileName = this.getBaseName(path);
    const parentHandle = await this.getDirectoryHandle(parentPath);
    try {
      return parentHandle.getFileHandle(fileName, options);
    } catch (error) {
      if (!options?.create) {
        // Convert OPFS error to ENOENT for consistency
        const errorWithCode = new Error(`ENOENT: no such file or directory, open '${path}'`) as NodeJS.ErrnoException;
        errorWithCode.code = 'ENOENT';
        errorWithCode.errno = -2;
        errorWithCode.syscall = 'open';
        errorWithCode.path = path;
        throw errorWithCode;
      }
      throw error;
    }
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
    try {
      // Guard against undefined path
      if (!path || typeof path !== 'string') {
        const error = new Error('ENOENT: no such file or directory, mkdir \'undefined\'') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        error.errno = -2;
        error.syscall = 'mkdir';
        error.path = path || 'undefined';
        throw error;
      }

      const parts = path.split('/').filter(Boolean);
      let currentHandle = await this.root;

      for (const part of parts) {
        try {
          currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
        } catch (error) {
          console.error(`Failed to create directory part '${part}' in path '${path}':`, error);
          // Convert to proper Node.js error
          const mkdirError = new Error(`ENOENT: no such file or directory, mkdir '${path}'`) as NodeJS.ErrnoException;
          mkdirError.code = 'ENOENT';
          mkdirError.errno = -2;
          mkdirError.syscall = 'mkdir';
          mkdirError.path = path;
          if (error instanceof Error) {
            mkdirError.message = `${mkdirError.message}: ${error.message}`;
          }
          throw mkdirError;
        }
      }
    } catch (error) {
      console.error(`OPFSAdapter.createDirectoriesRecursive failed for path: ${path}`, error);
      throw error;
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