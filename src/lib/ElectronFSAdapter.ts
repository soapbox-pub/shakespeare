import type { JSRuntimeFS, DirectoryEntry } from './JSRuntime';

/**
 * Electron filesystem adapter that implements JSRuntimeFS interface
 * This adapter communicates with Electron's main process via IPC to perform
 * filesystem operations on the actual OS filesystem.
 *
 * Note: This adapter should only be instantiated when running in Electron.
 */
export class ElectronFSAdapter implements JSRuntimeFS {
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

  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, options: 'utf8'): Promise<string>;
  async readFile(path: string, options: string): Promise<string>;
  async readFile(path: string, options: { encoding: 'utf8' }): Promise<string>;
  async readFile(path: string, options: { encoding: string }): Promise<string>;
  async readFile(path: string, options?: string | { encoding?: string }): Promise<string | Uint8Array>;
  async readFile(path: string, options?: string | { encoding?: string }): Promise<string | Uint8Array> {
    try {
      const encoding = typeof options === 'string' ? options : options?.encoding;
      const result = await this.electron.fs.readFile(path, encoding);

      // If no encoding, convert array to Uint8Array
      if (!encoding && Array.isArray(result)) {
        return new Uint8Array(result);
      }

      return result as string;
    } catch (error) {
      throw this.unwrapElectronError(error);
    }
  }

  async writeFile(path: string, data: string | Uint8Array, options?: string | { encoding?: string }): Promise<void> {
    try {
      const encoding = typeof options === 'string' ? options : options?.encoding;
      // Convert Uint8Array to regular array for IPC serialization
      const dataToWrite = data instanceof Uint8Array ? Array.from(data) : data;
      return await this.electron.fs.writeFile(path, dataToWrite, encoding);
    } catch (error) {
      throw this.unwrapElectronError(error);
    }
  }

  async readdir(path: string): Promise<string[]>;
  async readdir(path: string, options: { withFileTypes: true }): Promise<DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]> {
    try {
      const result = await this.electron.fs.readdir(path, options?.withFileTypes);

      if (options?.withFileTypes) {
        // Convert plain objects to DirectoryEntry format
        return (result as Array<{ name: string; isDirectory: boolean; isFile: boolean }>).map(entry => ({
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
      return await this.electron.fs.mkdir(path, recursive);
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
      const result = await this.electron.fs.stat(path);
      const now = Date.now();
      return {
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
      const result = await this.electron.fs.lstat(path);
      const now = Date.now();
      return {
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
    } catch (error) {
      throw this.unwrapElectronError(error);
    }
  }

  async unlink(path: string): Promise<void> {
    try {
      return await this.electron.fs.unlink(path);
    } catch (error) {
      throw this.unwrapElectronError(error);
    }
  }

  async rmdir(path: string): Promise<void> {
    try {
      return await this.electron.fs.rmdir(path);
    } catch (error) {
      throw this.unwrapElectronError(error);
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    try {
      return await this.electron.fs.rename(oldPath, newPath);
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
}
