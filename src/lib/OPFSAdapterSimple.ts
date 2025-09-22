import type { JSRuntimeFS, DirectoryEntry } from './JSRuntime';

/**
 * Simple OPFS (Origin Private File System) adapter that implements JSRuntimeFS interface
 * This version is designed to work with isomorphic-git with minimal interference
 */
export class OPFSAdapterSimple implements JSRuntimeFS {
  private root: Promise<FileSystemDirectoryHandle>;
  private debugMode: boolean = false;

  constructor(options?: { debug?: boolean }) {
    this.debugMode = options?.debug || false;

    // Check if OPFS is available
    if (!('storage' in navigator) ||
        typeof (navigator.storage as unknown as { getDirectory: () => Promise<FileSystemDirectoryHandle> }).getDirectory !== 'function') {
      throw new Error('OPFS is not supported in this browser or environment');
    }

    // Get the root directory handle for OPFS
    this.root = (navigator.storage as unknown as { getDirectory: () => Promise<FileSystemDirectoryHandle> }).getDirectory();

    if (this.debugMode) {
      console.log('OPFSAdapterSimple initialized with debug mode enabled');
    }
  }

  private log(...args: unknown[]) {
    if (this.debugMode) {
      console.log('[OPFSAdapter]', ...args);
    }
  }

  private logError(...args: unknown[]) {
    if (this.debugMode) {
      console.error('[OPFSAdapter]', ...args);
    }
  }

  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, encoding: 'utf8'): Promise<string>;
  async readFile(path: string, encoding: string): Promise<string>;
  async readFile(path: string, encoding?: string): Promise<string | Uint8Array>;
  async readFile(path: string, encoding?: string): Promise<string | Uint8Array> {
    this.log(`readFile called: path="${path}", encoding="${encoding}", type: ${typeof encoding}`);

    try {
      // Basic path validation - handle isomorphic-git calling with undefined paths
      // Note: isomorphic-git sometimes calls readFile with undefined paths to test filesystem capabilities
      if (!path || typeof path !== 'string' || path === 'undefined') {
        this.log(`Filesystem capability test with invalid path: ${path} (type: ${typeof path}) - this is normal`);
        const error = new Error(`ENOENT: no such file or directory, open '${path || 'undefined'}'`) as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        error.errno = -2;
        error.syscall = 'open';
        error.path = path || 'undefined';
        throw error;
      }

      const fileHandle = await this.getFileHandle(path);
      const file = await fileHandle.getFile();

      this.log(`File found: size=${file.size}, type="${file.type}", lastModified=${file.lastModified}`);

      // Additional validation for Git files
      if (path.includes('.git/') && file.size === 0) {
        this.logError(`Warning: Git file is empty: ${path}`);
      }

      // Handle encoding parameter exactly like LightningFS
      // Key insight: isomorphic-git sometimes passes options objects as encoding parameter
      // We need to distinguish between text files (config, refs, etc.) and binary files (pack, index, objects)

      // Git binary files that should ALWAYS be returned as Uint8Array
      const isGitBinaryFile = path.includes('.git/objects/pack/') ||
                             (path.includes('.git/objects/') && !path.includes('.git/objects/info/')) ||
                             path.endsWith('.pack') ||
                             path.endsWith('.idx') ||
                             path.includes('.git/index');

      // Git text files that should be returned as text when no explicit binary encoding is requested
      const isGitTextFile = path.includes('.git/config') ||
                           path.includes('.git/HEAD') ||
                           path.includes('.git/refs/') ||
                           path.includes('.git/logs/') ||
                           path.includes('.git/info/') ||
                           path.includes('.git/hooks/') ||
                           path.includes('.git/description');

      // Determine if we should return text:
      // 1. Explicit utf8 encoding request
      // 2. Git text files (unless explicit binary encoding)
      // 3. Non-Git files (unless explicit binary encoding)
      const shouldReturnText = (encoding === 'utf8' && typeof encoding === 'string') ||
                              (!isGitBinaryFile && (isGitTextFile || !path.includes('.git/'))) ||
                              (isGitTextFile && typeof encoding !== 'string');

      this.log(`File type analysis: isGitBinaryFile=${isGitBinaryFile}, isGitTextFile=${isGitTextFile}, shouldReturnText=${shouldReturnText}, encoding type=${typeof encoding}`);

      if (shouldReturnText) {
        const text = await file.text();
        this.log(`Returning text content for encoding "${encoding}", length=${text.length}`);
        return text;
      } else {
        // No encoding or undefined, return as Uint8Array (binary data)
        let arrayBuffer: ArrayBuffer;

        try {
          arrayBuffer = await file.arrayBuffer();
          if (!arrayBuffer) {
            throw new Error('ArrayBuffer is null or undefined');
          }
        } catch (bufferError) {
          this.logError(`Failed to get ArrayBuffer for ${path}:`, bufferError);
          throw new Error(`Failed to read binary data from file: ${path}`);
        }

        // Create a proper Uint8Array that behaves like Node.js Buffer/Uint8Array
        // This is critical for isomorphic-git compatibility
        let uint8Array: Uint8Array;

        try {
          uint8Array = new Uint8Array(arrayBuffer);

          // For Git pack files and other binary Git objects, we need to be extra careful
          // isomorphic-git expects very specific behavior from these arrays
          if (path.includes('.git/')) {
            // Create a fresh Uint8Array to avoid any browser-specific quirks
            const gitCompatibleArray = new Uint8Array(uint8Array.length);
            gitCompatibleArray.set(uint8Array);

            // Ensure the array has proper prototype and methods
            // Some isomorphic-git operations check for specific array methods
            if (!gitCompatibleArray.slice || typeof gitCompatibleArray.slice !== 'function') {
              this.logError(`Uint8Array missing slice method for Git file: ${path}`);
            }
            if (!gitCompatibleArray.subarray || typeof gitCompatibleArray.subarray !== 'function') {
              this.logError(`Uint8Array missing subarray method for Git file: ${path}`);
            }

            uint8Array = gitCompatibleArray;
          }

          // Validate the array before returning
          if (!uint8Array || uint8Array.length === undefined) {
            throw new Error(`Invalid Uint8Array created for file: ${path}`);
          }

          this.log(`Returning binary content: ${uint8Array.length} bytes, constructor: ${uint8Array.constructor.name}, isGitFile: ${path.includes('.git/')}`);
          return uint8Array;
        } catch (arrayError) {
          this.logError(`Failed to create Uint8Array for ${path}:`, arrayError);
          throw new Error(`Failed to create binary array from file: ${path}`);
        }
      }
    } catch (error) {
      this.logError(`readFile failed for path="${path}":`, error);

      // Enhanced error handling for isomorphic-git compatibility
      let finalError: Error & NodeJS.ErrnoException;

      if (error instanceof Error && (error.message.includes('NotFound') || error.name === 'NotFoundError')) {
        finalError = new Error(`ENOENT: no such file or directory, open '${path}'`) as NodeJS.ErrnoException;
        finalError.code = 'ENOENT';
        finalError.errno = -2;
        finalError.syscall = 'open';
        finalError.path = path;
      } else if (error instanceof Error) {
        // Wrap any other error to ensure it has required properties
        finalError = error as NodeJS.ErrnoException;
        if (!finalError.code) finalError.code = 'EIO';
        if (!finalError.errno) finalError.errno = -5;
        if (!finalError.syscall) finalError.syscall = 'read';
        if (!finalError.path) finalError.path = path;
      } else {
        // Convert non-Error objects to proper Error
        finalError = new Error(String(error)) as NodeJS.ErrnoException;
        finalError.code = 'EIO';
        finalError.errno = -5;
        finalError.syscall = 'read';
        finalError.path = path;
      }

      // Ensure the error has the original error information
      if (error instanceof Error && error !== finalError) {
        // finalError.cause = error; // Not available in older TypeScript
        finalError.stack = error.stack;
      }

      throw finalError;
    }
  }

  async writeFile(path: string, data: string | Uint8Array, _encoding?: string): Promise<void> {
    try {
      const fileHandle = await this.getFileHandle(path, { create: true });
      const writable = await fileHandle.createWritable();

      if (typeof data === 'string') {
        await writable.write(data);
      } else {
        // For binary data, ensure we write it correctly
        // Some browsers may have issues with Uint8Array variants
        if (data instanceof Uint8Array) {
          await writable.write(data);
        } else {
          // Convert ArrayBuffer or other array-like objects to Uint8Array
          const uint8Array = new Uint8Array(data);
          await writable.write(uint8Array);
        }
      }

      await writable.close();
    } catch (error) {
      // Enhanced error handling for write operations
      let finalError: Error & NodeJS.ErrnoException;

      if (error instanceof Error && (error.message.includes('NotFound') || error.name === 'NotFoundError')) {
        finalError = new Error(`ENOENT: no such file or directory, open '${path}'`) as NodeJS.ErrnoException;
        finalError.code = 'ENOENT';
        finalError.errno = -2;
        finalError.syscall = 'open';
        finalError.path = path;
      } else if (error instanceof Error) {
        finalError = error as NodeJS.ErrnoException;
        if (!finalError.code) finalError.code = 'EIO';
        if (!finalError.errno) finalError.errno = -5;
        if (!finalError.syscall) finalError.syscall = 'write';
        if (!finalError.path) finalError.path = path;
      } else {
        finalError = new Error(String(error)) as NodeJS.ErrnoException;
        finalError.code = 'EIO';
        finalError.errno = -5;
        finalError.syscall = 'write';
        finalError.path = path;
      }

      if (error instanceof Error && error !== finalError) {
        finalError.stack = error.stack;
      }

      throw finalError;
    }
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
        // Enhanced error handling for isomorphic-git compatibility
        let finalError: Error & NodeJS.ErrnoException;

        if (dirError instanceof Error && (dirError.message.includes('NotFound') || dirError.name === 'NotFoundError')) {
          finalError = new Error(`ENOENT: no such file or directory, stat '${path}'`) as NodeJS.ErrnoException;
          finalError.code = 'ENOENT';
          finalError.errno = -2;
          finalError.syscall = 'stat';
          finalError.path = path;
        } else if (dirError instanceof Error) {
          // Wrap any other error to ensure it has required properties
          finalError = dirError as NodeJS.ErrnoException;
          if (!finalError.code) finalError.code = 'UNKNOWN';
          if (!finalError.errno) finalError.errno = -1;
          if (!finalError.syscall) finalError.syscall = 'stat';
          if (!finalError.path) finalError.path = path;
        } else {
          // Convert non-Error objects to proper Error
          finalError = new Error(String(dirError)) as NodeJS.ErrnoException;
          finalError.code = 'UNKNOWN';
          finalError.errno = -1;
          finalError.syscall = 'stat';
          finalError.path = path;
        }

        // Ensure error has original error information
        if (dirError instanceof Error && dirError !== finalError) {
          finalError.stack = dirError.stack;
        }

        throw finalError;
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
      // Enhanced error handling for isomorphic-git compatibility
      let finalError: Error & NodeJS.ErrnoException;

      if (error instanceof Error && (error.message.includes('NotFound') || error.name === 'NotFoundError')) {
        finalError = new Error(`ENOENT: no such file or directory, readlink '${path}'`) as NodeJS.ErrnoException;
        finalError.code = 'ENOENT';
        finalError.errno = -2;
        finalError.syscall = 'readlink';
        finalError.path = path;
      } else if (error instanceof Error) {
        // Wrap any other error to ensure it has required properties
        finalError = error as NodeJS.ErrnoException;
        if (!finalError.code) finalError.code = 'UNKNOWN';
        if (!finalError.errno) finalError.errno = -1;
        if (!finalError.syscall) finalError.syscall = 'readlink';
        if (!finalError.path) finalError.path = path;
      } else {
        // Convert non-Error objects to proper Error
        finalError = new Error(String(error)) as NodeJS.ErrnoException;
        finalError.code = 'UNKNOWN';
        finalError.errno = -1;
        finalError.syscall = 'readlink';
        finalError.path = path;
      }

      // Ensure error has original error information
      if (error instanceof Error && error !== finalError) {
        finalError.stack = error.stack;
      }

      throw finalError;
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
      // Enhanced error handling for isomorphic-git compatibility
      let finalError: Error & NodeJS.ErrnoException;

      if (error instanceof Error && (error.message.includes('NotFound') || error.name === 'NotFoundError')) {
        finalError = new Error(`ENOENT: no such file or directory, symlink '${path}'`) as NodeJS.ErrnoException;
        finalError.code = 'ENOENT';
        finalError.errno = -2;
        finalError.syscall = 'symlink';
        finalError.path = path;
      } else if (error instanceof Error) {
        // Wrap any other error to ensure it has required properties
        finalError = error as NodeJS.ErrnoException;
        if (!finalError.code) finalError.code = 'UNKNOWN';
        if (!finalError.errno) finalError.errno = -1;
        if (!finalError.syscall) finalError.syscall = 'symlink';
        if (!finalError.path) finalError.path = path;
      } else {
        // Convert non-Error objects to proper Error
        finalError = new Error(String(error)) as NodeJS.ErrnoException;
        finalError.code = 'UNKNOWN';
        finalError.errno = -1;
        finalError.syscall = 'symlink';
        finalError.path = path;
      }

      // Ensure error has original error information
      if (error instanceof Error && error !== finalError) {
        finalError.stack = error.stack;
      }

      throw finalError;
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
        // Enhanced error handling for isomorphic-git compatibility
        let finalError: Error & NodeJS.ErrnoException;

        if (error instanceof Error && (error.message.includes('NotFound') || error.name === 'NotFoundError')) {
          if (options?.create) {
            // If we're supposed to create, this shouldn't happen, but re-throw with better error
            finalError = new Error(`Failed to create directory part '${part}' in path '${path}': ${error.message}`) as NodeJS.ErrnoException;
            finalError.code = 'EIO';
            finalError.errno = -5;
            finalError.syscall = 'mkdir';
            finalError.path = path;
          } else {
            // Directory doesn't exist and we're not creating it
            finalError = new Error(`ENOENT: no such file or directory, stat '${path}'`) as NodeJS.ErrnoException;
            finalError.code = 'ENOENT';
            finalError.errno = -2;
            finalError.syscall = 'stat';
            finalError.path = path;
          }
        } else if (error instanceof Error) {
          // Wrap any other error to ensure it has required properties
          finalError = error as NodeJS.ErrnoException;
          if (!finalError.code) finalError.code = 'UNKNOWN';
          if (!finalError.errno) finalError.errno = -1;
          if (!finalError.syscall) finalError.syscall = 'stat';
          if (!finalError.path) finalError.path = path;
        } else {
          // Convert non-Error objects to proper Error
          finalError = new Error(String(error)) as NodeJS.ErrnoException;
          finalError.code = 'UNKNOWN';
          finalError.errno = -1;
          finalError.syscall = 'stat';
          finalError.path = path;
        }

        // Ensure error has original error information
        if (error instanceof Error && error !== finalError) {
          finalError.stack = error.stack;
        }

        throw finalError;
      }
    }

    return currentHandle;
  }

  private async getFileHandle(path: string, options?: { create?: boolean }): Promise<FileSystemFileHandle> {
    // Basic path validation
    if (!path || typeof path !== 'string') {
      const error = new Error('ENOENT: no such file or directory, open \'undefined\'') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      error.errno = -2;
      error.syscall = 'open';
      error.path = 'undefined';
      throw error;
    }

    try {
      const parentPath = this.getParentPath(path);
      const fileName = this.getBaseName(path);
      const parentHandle = await this.getDirectoryHandle(parentPath);
      return parentHandle.getFileHandle(fileName, options);
    } catch (error) {
      // Enhanced error handling for isomorphic-git compatibility
      let finalError: Error & NodeJS.ErrnoException;

      if (error instanceof Error && (error.message.includes('NotFound') || error.name === 'NotFoundError')) {
        if (options?.create) {
          // If we're supposed to create, this shouldn't happen
          finalError = new Error(`ENOENT: no such file or directory, open '${path}'`) as NodeJS.ErrnoException;
          finalError.code = 'ENOENT';
          finalError.errno = -2;
          finalError.syscall = 'open';
          finalError.path = path;
        } else {
          // File doesn't exist and we're not creating it
          finalError = new Error(`ENOENT: no such file or directory, open '${path}'`) as NodeJS.ErrnoException;
          finalError.code = 'ENOENT';
          finalError.errno = -2;
          finalError.syscall = 'open';
          finalError.path = path;
        }
      } else if (error instanceof Error) {
        // Wrap any other error to ensure it has required properties
        finalError = error as NodeJS.ErrnoException;
        if (!finalError.code) finalError.code = 'UNKNOWN';
        if (!finalError.errno) finalError.errno = -1;
        if (!finalError.syscall) finalError.syscall = 'open';
        if (!finalError.path) finalError.path = path;
      } else {
        // Convert non-Error objects to proper Error
        finalError = new Error(String(error)) as NodeJS.ErrnoException;
        finalError.code = 'UNKNOWN';
        finalError.errno = -1;
        finalError.syscall = 'open';
        finalError.path = path;
      }

      // Ensure error has original error information
      if (error instanceof Error && error !== finalError) {
        finalError.stack = error.stack;
      }

      throw finalError;
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