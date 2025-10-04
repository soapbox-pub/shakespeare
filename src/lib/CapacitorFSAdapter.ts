/**
 * Capacitor Filesystem Adapter
 *
 * Adapts Capacitor's Filesystem plugin to work with the JSRuntimeFS interface.
 * This enables native filesystem storage on Android/iOS while maintaining
 * compatibility with existing code.
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { encodeBase64, decodeBase64 } from '@std/encoding/base64';
import path from 'path-browserify';
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
  private normalizePath(inputPath: string): string {
    // Normalize the path using path-browserify
    let normalized = path.normalize(inputPath);

    // Remove leading slash for Capacitor
    normalized = normalized.startsWith('/') ? normalized.slice(1) : normalized;

    // Remove ALL trailing slashes (important for file operations)
    // Capacitor treats paths with trailing slashes as directories
    // Use regex to remove all trailing slashes
    normalized = normalized.replace(/\/+$/, '');

    // Ensure we don't have empty path
    if (normalized === '' || normalized === '.') {
      normalized = '.';
    }

    return normalized;
  }

  /**
   * Read file as Uint8Array or string
   */
  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, options: 'utf8'): Promise<string>;
  async readFile(path: string, options: string): Promise<string>;
  async readFile(path: string, options: { encoding: 'utf8' }): Promise<string>;
  async readFile(path: string, options: { encoding: string }): Promise<string>;
  async readFile(path: string, options?: string | { encoding?: string }): Promise<string | Uint8Array>;
  async readFile(path: string, options?: string | { encoding?: string }): Promise<string | Uint8Array> {
    const normalizedPath = this.normalizePath(path);
    const encoding = typeof options === 'string' ? options : options?.encoding;

    if (encoding === 'utf8') {
      // Read as UTF-8 text
      const result = await Filesystem.readFile({
        path: normalizedPath,
        directory: this.baseDirectory,
        encoding: Encoding.UTF8,
      });
      if (result.data instanceof Blob) {
        return await result.data.text();
      } else {
        return result.data;
      }
    } else {
      // Read as base64 (no encoding specified)
      const result = await Filesystem.readFile({
        path: normalizedPath,
        directory: this.baseDirectory,
      });
      if (result.data instanceof Blob) {
        const base64 = await result.data.text();
        return decodeBase64(base64);
      } else {
        return decodeBase64(result.data);
      }
    }
  }

  /**
   * Write file from string or Uint8Array
   */
  async writeFile(filePath: string, data: string | Uint8Array, _options?: string | { encoding?: string }): Promise<void> {
    const normalizedPath = this.normalizePath(filePath);

    if (data instanceof Uint8Array) {
      // Write binary data as base64 (no encoding specified)
      const base64Data = encodeBase64(data);
      await Filesystem.writeFile({
        path: normalizedPath,
        directory: this.baseDirectory,
        data: base64Data,
      });
    } else {
      // Write string data as UTF-8
      await Filesystem.writeFile({
        path: normalizedPath,
        directory: this.baseDirectory,
        data: data,
        encoding: Encoding.UTF8,
      });
    }
  }

  /**
   * Read directory contents
   */
  async readdir(dirPath: string): Promise<string[]>;
  async readdir(dirPath: string, options: { withFileTypes: true }): Promise<DirectoryEntry[]>;
  async readdir(dirPath: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]>;
  async readdir(dirPath: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]> {
    try {
      const normalizedPath = this.normalizePath(dirPath);
      const result = await Filesystem.readdir({
        path: normalizedPath,
        directory: this.baseDirectory,
      });

      if (options?.withFileTypes) {
        // Get file type information for each entry
        const entries: DirectoryEntry[] = [];

        for (const file of result.files) {
          const fullPath = path.join(dirPath, file.name);

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
    } catch {
      const nodeError = new Error(`ENOENT: no such file or directory, scandir '${dirPath}'`) as NodeJS.ErrnoException;
      nodeError.code = 'ENOENT';
      nodeError.errno = -2;
      nodeError.syscall = 'scandir';
      nodeError.path = dirPath;
      throw nodeError;
    }
  }

  /**
   * Create directory
   */
  async mkdir(path: string): Promise<void> {
    try {
      await Filesystem.mkdir({
        path: this.normalizePath(path),
        directory: this.baseDirectory,
        recursive: true,
      });
    } catch (error) {
      // Ignore "directory exists" errors when recursive is true
      if (error instanceof Error && (error.message.includes('exists') || error.message.includes('EEXIST'))) {
        return;
      } else {
        throw error;
      }
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
      const normalizedPath = this.normalizePath(path);
      const result = await Filesystem.stat({
        path: normalizedPath,
        directory: this.baseDirectory,
      });

      return {
        isDirectory: () => result.type === 'directory',
        isFile: () => result.type === 'file',
        size: result.size,
        mtimeMs: result.mtime,
      };
    } catch {
      // Create a proper Node.js-style error
      const nodeError = new Error(`ENOENT: no such file or directory, stat '${path}'`) as NodeJS.ErrnoException;
      nodeError.code = 'ENOENT';
      nodeError.errno = -2;
      nodeError.syscall = 'stat';
      nodeError.path = path;
      throw nodeError;
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
    try {
      const normalizedPath = this.normalizePath(path);
      const result = await Filesystem.stat({
        path: normalizedPath,
        directory: this.baseDirectory,
      });

      return {
        isDirectory: () => result.type === 'directory',
        isFile: () => result.type === 'file',
        size: result.size,
        mtimeMs: result.mtime,
      };
    } catch {
      // Create a proper Node.js-style error
      const nodeError = new Error(`ENOENT: no such file or directory, lstat '${path}'`) as NodeJS.ErrnoException;
      nodeError.code = 'ENOENT';
      nodeError.errno = -2;
      nodeError.syscall = 'lstat';
      nodeError.path = path;
      throw nodeError;
    }
  }

  /**
   * Delete file
   */
  async unlink(path: string): Promise<void> {
    try {
      const normalizedPath = this.normalizePath(path);
      await Filesystem.deleteFile({
        path: normalizedPath,
        directory: this.baseDirectory,
      });
    } catch {
      const nodeError = new Error(`ENOENT: no such file or directory, unlink '${path}'`) as NodeJS.ErrnoException;
      nodeError.code = 'ENOENT';
      nodeError.errno = -2;
      nodeError.syscall = 'unlink';
      nodeError.path = path;
      throw nodeError;
    }
  }

  /**
   * Remove directory
   */
  async rmdir(path: string): Promise<void> {
    await Filesystem.rmdir({
      path: this.normalizePath(path),
      directory: this.baseDirectory,
      recursive: false, // Only remove if empty
    });
  }

  /**
   * Rename/move file or directory
   */
  async rename(oldPath: string, newPath: string): Promise<void> {
    await Filesystem.rename({
      from: this.normalizePath(oldPath),
      to: this.normalizePath(newPath),
      directory: this.baseDirectory,
    });
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
    // Copy the target file to the symlink location
    const data = await this.readFile(target);
    await this.writeFile(path, data);

    // Store symlink metadata for readlink
    const symlinkPath = `${path}.symlink`;
    await this.writeFile(symlinkPath, target);
  }
}
