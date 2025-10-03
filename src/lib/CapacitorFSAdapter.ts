/**
 * Capacitor Filesystem Adapter
 * 
 * Adapts Capacitor's Filesystem plugin to work with the JSRuntimeFS interface.
 * This enables native filesystem storage on Android/iOS while maintaining
 * compatibility with existing code.
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import type { JSRuntimeFS, DirectoryEntry } from './JSRuntime';

export class CapacitorFSAdapter implements JSRuntimeFS {
  /**
   * Base directory for all file operations
   * Directory.Data is app-private and included in backups
   */
  private baseDirectory = Directory.Data;

  /**
   * Convert absolute paths to relative paths for Capacitor
   * Capacitor expects paths relative to the base directory
   */
  private normalizePath(path: string): string {
    // Remove leading slash for Capacitor
    let normalized = path.startsWith('/') ? path.slice(1) : path;
    
    // Ensure we don't have empty path
    if (normalized === '') {
      normalized = '.';
    }
    
    return normalized;
  }

  /**
   * Convert base64 string to Uint8Array
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Convert Uint8Array to base64 string
   */
  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Read file as Uint8Array or string
   */
  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, encoding: 'utf8'): Promise<string>;
  async readFile(path: string, encoding: string): Promise<string>;
  async readFile(path: string, encoding?: string): Promise<string | Uint8Array>;
  async readFile(path: string, encoding?: string): Promise<string | Uint8Array> {
    try {
      const result = await Filesystem.readFile({
        path: this.normalizePath(path),
        directory: this.baseDirectory,
        encoding: encoding === 'utf8' ? Encoding.UTF8 : undefined,
      });

      if (encoding === 'utf8') {
        return result.data as string;
      }

      // Binary data is returned as base64, convert to Uint8Array
      return this.base64ToUint8Array(result.data as string);
    } catch (error) {
      // Convert Capacitor errors to standard Node.js-style errors
      const err = error as { message: string };
      throw new Error(`ENOENT: no such file or directory, open '${path}': ${err.message}`);
    }
  }

  /**
   * Write file from string or Uint8Array
   */
  async writeFile(path: string, data: string | Uint8Array, encoding?: string): Promise<void> {
    try {
      // Ensure parent directory exists
      const parentPath = path.split('/').slice(0, -1).join('/');
      if (parentPath && parentPath !== '.') {
        await this.mkdir(parentPath, { recursive: true });
      }

      let writeData: string;
      let writeEncoding: Encoding | undefined;

      if (data instanceof Uint8Array) {
        // Convert binary data to base64 for Capacitor
        writeData = this.uint8ArrayToBase64(data);
        writeEncoding = undefined; // Base64 is the default
      } else {
        writeData = data;
        writeEncoding = encoding === 'utf8' ? Encoding.UTF8 : undefined;
      }

      await Filesystem.writeFile({
        path: this.normalizePath(path),
        directory: this.baseDirectory,
        data: writeData,
        encoding: writeEncoding,
        recursive: true, // Create parent directories
      });
    } catch (error) {
      const err = error as { message: string };
      throw new Error(`Failed to write file '${path}': ${err.message}`);
    }
  }

  /**
   * Read directory contents
   */
  async readdir(path: string): Promise<string[]>;
  async readdir(path: string, options: { withFileTypes: true }): Promise<DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]> {
    try {
      const result = await Filesystem.readdir({
        path: this.normalizePath(path),
        directory: this.baseDirectory,
      });

      if (options?.withFileTypes) {
        // Get file type information for each entry
        const entries: DirectoryEntry[] = [];

        for (const file of result.files) {
          const fullPath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
          
          try {
            const stat = await this.stat(fullPath);
            entries.push({
              name: file.name,
              isDirectory: () => stat.isDirectory(),
              isFile: () => stat.isFile(),
            });
          } catch {
            // If stat fails, assume it's a file
            entries.push({
              name: file.name,
              isDirectory: () => false,
              isFile: () => true,
            });
          }
        }

        return entries;
      }

      return result.files.map(f => f.name);
    } catch (error) {
      const err = error as { message: string };
      throw new Error(`ENOENT: no such file or directory, scandir '${path}': ${err.message}`);
    }
  }

  /**
   * Create directory
   */
  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    try {
      await Filesystem.mkdir({
        path: this.normalizePath(path),
        directory: this.baseDirectory,
        recursive: options?.recursive ?? false,
      });
    } catch (error) {
      // Ignore "directory exists" errors when recursive is true
      if (options?.recursive) {
        const err = error as { message: string };
        if (err.message.includes('exists') || err.message.includes('EEXIST')) {
          return;
        }
      }
      throw error;
    }
  }

  /**
   * Get file/directory stats
   */
  async stat(path: string): Promise<{
    isDirectory(): boolean;
    isFile(): boolean;
    size?: number;
    mtimeMs?: number;
  }> {
    try {
      const result = await Filesystem.stat({
        path: this.normalizePath(path),
        directory: this.baseDirectory,
      });

      return {
        isDirectory: () => result.type === 'directory',
        isFile: () => result.type === 'file',
        size: result.size,
        mtimeMs: result.mtime,
      };
    } catch (error) {
      const err = error as { message: string };
      throw new Error(`ENOENT: no such file or directory, stat '${path}': ${err.message}`);
    }
  }

  /**
   * Get file/directory stats (same as stat for Capacitor)
   */
  async lstat(path: string): Promise<{
    isDirectory(): boolean;
    isFile(): boolean;
    size?: number;
    mtimeMs?: number;
  }> {
    // Capacitor doesn't distinguish between stat and lstat
    return this.stat(path);
  }

  /**
   * Delete file
   */
  async unlink(path: string): Promise<void> {
    try {
      await Filesystem.deleteFile({
        path: this.normalizePath(path),
        directory: this.baseDirectory,
      });
    } catch (error) {
      const err = error as { message: string };
      throw new Error(`ENOENT: no such file or directory, unlink '${path}': ${err.message}`);
    }
  }

  /**
   * Remove directory
   */
  async rmdir(path: string): Promise<void> {
    try {
      await Filesystem.rmdir({
        path: this.normalizePath(path),
        directory: this.baseDirectory,
        recursive: false, // Only remove if empty
      });
    } catch (error) {
      const err = error as { message: string };
      throw new Error(`Failed to remove directory '${path}': ${err.message}`);
    }
  }

  /**
   * Rename/move file or directory
   */
  async rename(oldPath: string, newPath: string): Promise<void> {
    try {
      await Filesystem.rename({
        from: this.normalizePath(oldPath),
        to: this.normalizePath(newPath),
        directory: this.baseDirectory,
      });
    } catch (error) {
      const err = error as { message: string };
      throw new Error(`Failed to rename '${oldPath}' to '${newPath}': ${err.message}`);
    }
  }

  /**
   * Read symbolic link
   * Note: Capacitor doesn't support symlinks, so we implement a workaround
   * by storing symlink info in a special file
   */
  async readlink(path: string): Promise<string> {
    try {
      // Try to read symlink metadata file
      const symlinkPath = `${path}.symlink`;
      const target = await this.readFile(symlinkPath, 'utf8');
      return target;
    } catch {
      throw new Error(`Symbolic links are not fully supported on this platform: ${path}`);
    }
  }

  /**
   * Create symbolic link
   * Note: Capacitor doesn't support symlinks, so we implement a workaround
   * by copying the file instead and storing symlink metadata
   */
  async symlink(target: string, path: string): Promise<void> {
    try {
      // Copy the target file to the symlink location
      const data = await this.readFile(target);
      await this.writeFile(path, data);
      
      // Store symlink metadata for readlink
      const symlinkPath = `${path}.symlink`;
      await this.writeFile(symlinkPath, target, 'utf8');
    } catch (error) {
      const err = error as { message: string };
      throw new Error(`Failed to create symlink '${target}' -> '${path}': ${err.message}`);
    }
  }
}
