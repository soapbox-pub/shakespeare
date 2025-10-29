/**
 * TypeScript definitions for the Electron API exposed to the renderer process.
 *
 * Add this to your tsconfig.json include array to use these types:
 * "include": ["src", "electron/electron.d.ts"]
 */

interface DirectoryEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

interface StatResult {
  isDirectory: boolean;
  isFile: boolean;
  isBlockDevice: boolean;
  isCharacterDevice: boolean;
  isSymbolicLink: boolean;
  isFIFO: boolean;
  isSocket: boolean;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
  atimeMs: number;
  // Timestamps (serialized as numbers for IPC)
  mtime: number;
  ctime: number;
  atime: number;
}

interface ElectronFSAPI {
  readFile(path: string, encoding?: string): Promise<string | number[]>;
  writeFile(path: string, data: string | number[], encoding?: string): Promise<void>;
  readdir(path: string, withFileTypes?: boolean): Promise<string[] | DirectoryEntry[]>;
  mkdir(path: string, recursive?: boolean): Promise<void>;
  stat(path: string): Promise<StatResult>;
  lstat(path: string): Promise<StatResult>;
  unlink(path: string): Promise<void>;
  rmdir(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  readlink(path: string): Promise<string>;
  symlink(target: string, path: string): Promise<void>;
}

interface ShellExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface ElectronShellAPI {
  /**
   * Execute a shell command on the host OS.
   * @param command - The command to execute
   * @param cwd - Working directory (relative to ~/shakespeare)
   * @returns Promise with stdout, stderr, and exit code
   */
  exec(command: string, cwd?: string): Promise<ShellExecResult>;
}

interface ElectronAPI {
  /**
   * Get the current platform.
   * @returns 'darwin' | 'win32' | 'linux'
   */
  platform(): Promise<string>;

  /**
   * Get the application version from package.json.
   * @returns Version string (e.g., "1.0.0")
   */
  version(): Promise<string>;

  /**
   * Filesystem API for accessing the local OS filesystem.
   * All paths are relative to ~/shakespeare directory.
   */
  fs: ElectronFSAPI;

  /**
   * Shell API for executing real shell commands on the host OS.
   * All paths in commands are relative to ~/shakespeare directory.
   */
  shell: ElectronShellAPI;
}

interface Window {
  /**
   * Electron API exposed via preload script.
   * Only available when running in Electron.
   */
  electron?: ElectronAPI;
}
