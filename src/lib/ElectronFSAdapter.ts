import type { JSRuntimeFS, DirectoryEntry } from './JSRuntime';
import { getParentDirectory } from './pathUtils';

/**
 * Error object returned from IPC handlers instead of throwing
 * to avoid Electron's noisy error logging for expected errors.
 */
interface IPCErrorResult {
  __error: true;
  code: string;
  message: string;
}

/**
 * Type guard to check if an IPC result is an error object.
 */
function isIPCError(result: unknown): result is IPCErrorResult {
  return result !== null && 
         typeof result === 'object' && 
         '__error' in result && 
         (result as IPCErrorResult).__error === true;
}

/**
 * Electron filesystem adapter that implements JSRuntimeFS interface
 * This adapter communicates with Electron's main process via IPC to perform
 * filesystem operations on the actual OS filesystem.
 *
 * Note: This adapter should only be instantiated when running in Electron.
 */
/** Stat result with function methods matching the JSRuntimeFS interface */
interface StatResult {
  isDirectory(): boolean;
  isFile(): boolean;
  isBlockDevice(): boolean;
  isCharacterDevice(): boolean;
  isSymbolicLink(): boolean;
  isFIFO(): boolean;
  isSocket(): boolean;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
  atimeMs: number;
  mtime: Date;
  ctime: Date;
  atime: Date;
}

export class ElectronFSAdapter implements JSRuntimeFS {
  // Cache for stat results to avoid repeated IPC calls
  private statCache = new Map<string, { result: StatResult; timestamp: number }>();
  private readonly STAT_CACHE_TTL = 1000; // 1 second TTL for stat cache

  // Cache for ENOENT results to avoid repeated failed reads (especially for git objects)
  private enoentCache = new Set<string>();
  private readonly ENOENT_CACHE_MAX_SIZE = 5000;

  private get electron() {
    if (!window.electron) {
      throw new Error('ElectronFSAdapter can only be used in Electron environment');
    }
    return window.electron;
  }

  /**
   * Unwrap Electron IPC errors to preserve error codes.
   * Electron wraps errors in "Error invoking remote method..." messages,
   * but we need to preserve the original error code for isomorphic-git.
   */
  private unwrapElectronError(error: unknown): Error {
    if (!(error instanceof Error)) {
      return error as Error;
    }

    // Extract error code from the error object if it exists
    const code = (error as NodeJS.ErrnoException).code;

    // If there's already a code, preserve it
    if (code) {
      const err = new Error(error.message);
      (err as NodeJS.ErrnoException).code = code;
      return err;
    }

    // If no code property, try to extract from the message
    // Messages look like: "Error invoking remote method 'fs:stat': Error: Failed to stat /path: ENOENT: no such file or directory"
    const match = error.message.match(/:\s*(E[A-Z]+):/);
    if (match) {
      const err = new Error(error.message);
      (err as NodeJS.ErrnoException).code = match[1];
      return err;
    }

    return error;
  }

  async readFile(path: string): Promise<Uint8Array<ArrayBufferLike>>;
  async readFile(path: string, options: 'utf8'): Promise<string>;
  async readFile(path: string, options: string): Promise<string>;
  async readFile(path: string, options: { encoding: 'utf8' }): Promise<string>;
  async readFile(path: string, options: { encoding: string }): Promise<string>;
  async readFile(path: string, options?: string | { encoding?: string }): Promise<string | Uint8Array<ArrayBufferLike>>;
  async readFile(path: string, options?: string | { encoding?: string }): Promise<string | Uint8Array<ArrayBufferLike>> {
    try {
      // Validate path is not empty (isomorphic-git sometimes passes empty strings during ref resolution)
      if (!path || path.trim() === '') {
        const err = new Error(`EINVAL: invalid path ''`);
        (err as NodeJS.ErrnoException).code = 'EINVAL';
        throw err;
      }

      // Check if we've already seen ENOENT for this path (common for git packed objects)
      if (this.enoentCache.has(path)) {
        const err = new Error(`ENOENT: no such file or directory, open '${path}'`);
        (err as NodeJS.ErrnoException).code = 'ENOENT';
        throw err;
      }

      const encoding = typeof options === 'string' ? options : options?.encoding;
      const result = await this.electron.fs.readFile(path, encoding);

      // Handle error objects returned from IPC (to avoid Electron's noisy error logging)
      if (isIPCError(result)) {
        const err = new Error(result.message);
        (err as NodeJS.ErrnoException).code = result.code;
        
        // Cache ENOENT errors
        if (result.code === 'ENOENT') {
          this.enoentCache.add(path);
          if (this.enoentCache.size > this.ENOENT_CACHE_MAX_SIZE) {
            const entries = Array.from(this.enoentCache);
            entries.slice(0, 1000).forEach(entry => this.enoentCache.delete(entry));
          }
        }
        
        throw err;
      }

      // If no encoding, convert array to Uint8Array
      if (!encoding && Array.isArray(result)) {
        return new Uint8Array(result);
      }

      return result as string;
    } catch (error) {
      const unwrapped = this.unwrapElectronError(error);

      // Cache ENOENT errors to avoid repeated IPC calls for missing files
      // This is especially important for git packed objects that isomorphic-git tries to read
      if ((unwrapped as NodeJS.ErrnoException).code === 'ENOENT') {
        this.enoentCache.add(path);

        // Limit cache size to prevent memory leaks
        if (this.enoentCache.size > this.ENOENT_CACHE_MAX_SIZE) {
          // Clear oldest entries (first 1000)
          const entries = Array.from(this.enoentCache);
          entries.slice(0, 1000).forEach(entry => this.enoentCache.delete(entry));
        }
      }

      throw unwrapped;
    }
  }

  async writeFile(path: string, data: string | Uint8Array<ArrayBufferLike>, options?: string | { encoding?: string }): Promise<void> {
    try {
      const encoding = typeof options === 'string' ? options : options?.encoding;
      // Convert Uint8Array to regular array for IPC serialization
      const dataToWrite = data instanceof Uint8Array ? Array.from(data) : data;
      const result = await this.electron.fs.writeFile(path, dataToWrite, encoding);

      // Invalidate caches for this path and its parent directory
      this.statCache.delete(path);
      this.statCache.delete(`lstat:${path}`);
      this.enoentCache.delete(path); // File now exists
      const parentDir = getParentDirectory(path);
      if (parentDir) {
        this.statCache.delete(parentDir);
        this.statCache.delete(`lstat:${parentDir}`);
      }

      return result;
    } catch (error) {
      throw this.unwrapElectronError(error);
    }
  }

  async readdir(path: string): Promise<string[]>;
  async readdir(path: string, options: { withFileTypes: true }): Promise<DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]> {
    try {
      // Fast path: check if this is a file first (common case causing errors)
      // Use cached stat if available to avoid extra IPC call
      const cached = this.statCache.get(path);
      if (cached && Date.now() - cached.timestamp < this.STAT_CACHE_TTL) {
        // Note: cached.result has isFile as a function (from statResult), so we must call it
        if (cached.result.isFile()) {
          // This is a file, not a directory - throw ENOTDIR immediately
          const err = new Error(`ENOTDIR: not a directory, scandir '${path}'`);
          (err as NodeJS.ErrnoException).code = 'ENOTDIR';
          throw err;
        }
      } else {
        // No cached stat - do a stat check first to avoid unnecessary readdir IPC calls on files
        // This is important for performance since FileTree iterates all entries and calls readdir on each
        try {
          const statResult = await this.stat(path);
          if (statResult.isFile()) {
            const err = new Error(`ENOTDIR: not a directory, scandir '${path}'`);
            (err as NodeJS.ErrnoException).code = 'ENOTDIR';
            throw err;
          }
        } catch (statError) {
          // If stat fails with ENOENT, let readdir handle it
          if ((statError as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw statError;
          }
        }
      }

      const result = await this.electron.fs.readdir(path, options?.withFileTypes);

      // Handle error objects returned from IPC (to avoid Electron's noisy error logging)
      if (isIPCError(result)) {
        const err = new Error(result.message);
        (err as NodeJS.ErrnoException).code = result.code;
        throw err;
      }

      if (options?.withFileTypes) {
        const entries = result as Array<{ name: string; isDirectory: boolean; isFile: boolean }>;
        const now = Date.now();
        
        // Cache the file type info for each child entry to speed up subsequent stat/readdir calls
        // This is a key optimization - FileTree calls readdir on all children, and we can fast-fail
        // files without hitting IPC
        for (const entry of entries) {
          const childPath = path.endsWith('/') ? `${path}${entry.name}` : `${path}/${entry.name}`;
          const nowDate = new Date(now);
          const statResult: StatResult = {
            isDirectory: () => entry.isDirectory,
            isFile: () => entry.isFile,
            isBlockDevice: () => false,
            isCharacterDevice: () => false,
            isSymbolicLink: () => false,
            isFIFO: () => false,
            isSocket: () => false,
            size: 0,
            mtimeMs: now,
            ctimeMs: now,
            atimeMs: now,
            mtime: nowDate,
            ctime: nowDate,
            atime: nowDate,
          };
          this.statCache.set(childPath, { result: statResult, timestamp: now });
        }

        // Convert plain objects to DirectoryEntry format
        return entries.map(entry => ({
          name: entry.name,
          isDirectory: () => entry.isDirectory,
          isFile: () => entry.isFile,
        }));
      }

      return result as string[];
    } catch (error) {
      throw this.unwrapElectronError(error);
    }
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    try {
      // Default to recursive: true for isomorphic-git compatibility
      // isomorphic-git expects mkdir to behave like 'mkdir -p'
      const recursive = options?.recursive !== false;
      const result = await this.electron.fs.mkdir(path, recursive);

      // Invalidate cache for this path and parent
      this.statCache.delete(path);
      this.statCache.delete(`lstat:${path}`);
      const parentDir = getParentDirectory(path);
      if (parentDir) {
        this.statCache.delete(parentDir);
        this.statCache.delete(`lstat:${parentDir}`);
      }

      return result;
    } catch (error) {
      throw this.unwrapElectronError(error);
    }
  }

  async stat(path: string): Promise<{
    isDirectory(): boolean;
    isFile(): boolean;
    isBlockDevice(): boolean;
    isCharacterDevice(): boolean;
    isSymbolicLink(): boolean;
    isFIFO(): boolean;
    isSocket(): boolean;
    size: number;
    mtimeMs: number;
    ctimeMs: number;
    atimeMs: number;
    mtime: Date;
    ctime: Date;
    atime: Date;
  }> {
    try {
      // Check cache first
      const cached = this.statCache.get(path);
      if (cached && Date.now() - cached.timestamp < this.STAT_CACHE_TTL) {
        return cached.result;
      }

      const result = await this.electron.fs.stat(path);
      
      // Handle error objects returned from IPC (to avoid Electron's noisy error logging)
      if (isIPCError(result)) {
        const err = new Error(result.message);
        (err as NodeJS.ErrnoException).code = result.code;
        throw err;
      }
      
      const now = Date.now();
      const statResult = {
        isDirectory: () => result.isDirectory,
        isFile: () => result.isFile,
        isBlockDevice: () => result.isBlockDevice,
        isCharacterDevice: () => result.isCharacterDevice,
        isSymbolicLink: () => result.isSymbolicLink,
        isFIFO: () => result.isFIFO,
        isSocket: () => result.isSocket,
        size: result.size ?? 0,
        mtimeMs: result.mtimeMs ?? now,
        ctimeMs: result.ctimeMs ?? now,
        atimeMs: result.atimeMs ?? now,
        // Convert timestamps back to Date objects
        mtime: new Date(result.mtime ?? now),
        ctime: new Date(result.ctime ?? now),
        atime: new Date(result.atime ?? now),
      };

      // Cache the result
      this.statCache.set(path, { result: statResult, timestamp: Date.now() });

      // Limit cache size to prevent memory leaks
      if (this.statCache.size > 10000) {
        // Remove oldest entries (first 1000)
        const entries = Array.from(this.statCache.entries());
        entries.slice(0, 1000).forEach(([key]) => this.statCache.delete(key));
      }

      return statResult;
    } catch (error) {
      // Electron IPC wraps errors, extract the original error code
      throw this.unwrapElectronError(error);
    }
  }

  async lstat(path: string): Promise<{
    isDirectory(): boolean;
    isFile(): boolean;
    isBlockDevice(): boolean;
    isCharacterDevice(): boolean;
    isSymbolicLink(): boolean;
    isFIFO(): boolean;
    isSocket(): boolean;
    size: number;
    mtimeMs: number;
    ctimeMs: number;
    atimeMs: number;
    mtime: Date;
    ctime: Date;
    atime: Date;
  }> {
    try {
      // Check cache first (use separate cache key for lstat)
      const cacheKey = `lstat:${path}`;
      const cached = this.statCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.STAT_CACHE_TTL) {
        return cached.result;
      }

      const result = await this.electron.fs.lstat(path);
      
      // Handle error objects returned from IPC (to avoid Electron's noisy error logging)
      if (isIPCError(result)) {
        const err = new Error(result.message);
        (err as NodeJS.ErrnoException).code = result.code;
        throw err;
      }
      
      const now = Date.now();
      const statResult = {
        isDirectory: () => result.isDirectory,
        isFile: () => result.isFile,
        isBlockDevice: () => result.isBlockDevice,
        isCharacterDevice: () => result.isCharacterDevice,
        isSymbolicLink: () => result.isSymbolicLink,
        isFIFO: () => result.isFIFO,
        isSocket: () => result.isSocket,
        size: result.size ?? 0,
        mtimeMs: result.mtimeMs ?? now,
        ctimeMs: result.ctimeMs ?? now,
        atimeMs: result.atimeMs ?? now,
        // Convert timestamps back to Date objects
        mtime: new Date(result.mtime ?? now),
        ctime: new Date(result.ctime ?? now),
        atime: new Date(result.atime ?? now),
      };

      // Cache the result
      this.statCache.set(cacheKey, { result: statResult, timestamp: Date.now() });

      // Limit cache size to prevent memory leaks
      if (this.statCache.size > 10000) {
        // Remove oldest entries (first 1000)
        const entries = Array.from(this.statCache.entries());
        entries.slice(0, 1000).forEach(([key]) => this.statCache.delete(key));
      }

      return statResult;
    } catch (error) {
      throw this.unwrapElectronError(error);
    }
  }

  async unlink(path: string): Promise<void> {
    try {
      const result = await this.electron.fs.unlink(path);

      // Handle error objects returned from IPC (to avoid Electron's noisy error logging)
      if (isIPCError(result)) {
        const err = new Error(result.message);
        (err as NodeJS.ErrnoException).code = result.code;
        throw err;
      }

      // Invalidate cache for this path and parent
      this.statCache.delete(path);
      this.statCache.delete(`lstat:${path}`);
      const parentDir = getParentDirectory(path);
      if (parentDir) {
        this.statCache.delete(parentDir);
        this.statCache.delete(`lstat:${parentDir}`);
      }

      return result;
    } catch (error) {
      throw this.unwrapElectronError(error);
    }
  }

  async rmdir(path: string): Promise<void> {
    try {
      const result = await this.electron.fs.rmdir(path);

      // Invalidate cache for this path and parent
      this.statCache.delete(path);
      this.statCache.delete(`lstat:${path}`);
      const parentDir = getParentDirectory(path);
      if (parentDir) {
        this.statCache.delete(parentDir);
        this.statCache.delete(`lstat:${parentDir}`);
      }

      return result;
    } catch (error) {
      throw this.unwrapElectronError(error);
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    try {
      const result = await this.electron.fs.rename(oldPath, newPath);

      // Invalidate cache for both paths and their parents
      this.statCache.delete(oldPath);
      this.statCache.delete(`lstat:${oldPath}`);
      this.statCache.delete(newPath);
      this.statCache.delete(`lstat:${newPath}`);

      const oldParent = getParentDirectory(oldPath);
      if (oldParent) {
        this.statCache.delete(oldParent);
        this.statCache.delete(`lstat:${oldParent}`);
      }

      const newParent = getParentDirectory(newPath);
      if (newParent) {
        this.statCache.delete(newParent);
        this.statCache.delete(`lstat:${newParent}`);
      }

      return result;
    } catch (error) {
      throw this.unwrapElectronError(error);
    }
  }

  async readlink(path: string): Promise<string> {
    try {
      return await this.electron.fs.readlink(path);
    } catch (error) {
      throw this.unwrapElectronError(error);
    }
  }

  async symlink(target: string, path: string): Promise<void> {
    try {
      return await this.electron.fs.symlink(target, path);
    } catch (error) {
      throw this.unwrapElectronError(error);
    }
  }

  /**
   * Clear all caches. Useful when switching projects or after major filesystem changes.
   */
  clearCaches(): void {
    this.statCache.clear();
    this.enoentCache.clear();
  }
}
