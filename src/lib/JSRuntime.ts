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
 */
export interface JSRuntimeFS {
  readFile(path: string, encoding?: string): Promise<string | Uint8Array>;
  writeFile(path: string, data: string | Uint8Array): Promise<void>;
  readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  stat(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean }>;
}

/**
 * JavaScript runtime interface for executing code and managing files
 */
export interface JSRuntime {
  /**
   * Filesystem access
   */
  readonly fs: JSRuntimeFS;

  /**
   * Spawn a process in the runtime environment
   * @param command Command to execute
   * @param args Command arguments
   * @param options Spawn options
   * @returns Process handle
   */
  spawn(command: string, args?: string[], options?: Record<string, unknown>): Promise<WebContainerProcess>;
}