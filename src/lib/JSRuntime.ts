import type { WebContainerProcess } from '@webcontainer/api';

/**
 * Directory entry with file type information
 */
export interface DirectoryEntry {
  name: string;
  isDirectory(): boolean;
  isFile(): boolean;
}

/**
 * Filesystem interface compatible with both WebContainer and LightningFS
 * This interface unifies the APIs of both filesystem implementations
 */
export interface JSRuntimeFS {
  // Core file operations with proper overloads for type safety
  readFile(path: string): Promise<Uint8Array>;
  readFile(path: string, encoding: 'utf8'): Promise<string>;
  readFile(path: string, encoding: string): Promise<string>;
  readFile(path: string, encoding?: string): Promise<string | Uint8Array>;

  writeFile(path: string, data: string | Uint8Array, encoding?: string): Promise<void>;

  // readdir overloads for different return types
  readdir(path: string): Promise<string[]>;
  readdir(path: string, options: { withFileTypes: true }): Promise<DirectoryEntry[]>;
  readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]>;

  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  stat(path: string): Promise<{
    isDirectory(): boolean;
    isFile(): boolean;
    size?: number;
    mtimeMs?: number;
  }>;
  lstat(path: string): Promise<{
    isDirectory(): boolean;
    isFile(): boolean;
    size?: number;
    mtimeMs?: number;
  }>;

  // Additional operations that LightningFS supports
  unlink(path: string): Promise<void>;
  rmdir(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  readlink(path: string): Promise<string>;
  symlink(target: string, path: string): Promise<void>;
}

/**
 * JavaScript runtime interface for executing code and managing files
 */
export interface JSRuntime {
  /**
   * Filesystem access
   */
  fs(): Promise<JSRuntimeFS>;

  /**
   * Spawn a process in the runtime environment
   * @param command Command to execute
   * @param args Command arguments
   * @param options Spawn options
   * @returns Process handle
   */
  spawn(command: string, args?: string[], options?: Record<string, unknown>): Promise<WebContainerProcess>;
}