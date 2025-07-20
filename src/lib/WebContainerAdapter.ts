import { WebContainer, type WebContainerProcess } from '@webcontainer/api';
import type { JSRuntime, JSRuntimeFS, DirectoryEntry } from './JSRuntime';

/**
 * WebContainer adapter that implements the JSRuntime interface
 */
export class WebContainerAdapter implements JSRuntime {
  private webcontainer: WebContainer | null = null;
  private bootPromise: Promise<WebContainer> | null = null;
  private _fs: JSRuntimeFS | null = null;

  /**
   * Get the filesystem interface
   */
  get fs(): JSRuntimeFS {
    if (!this._fs) {
      throw new Error('WebContainer not initialized. Call spawn() first to initialize.');
    }
    return this._fs;
  }

  /**
   * Ensure WebContainer is booted
   */
  private async ensureBooted(): Promise<WebContainer> {
    if (this.webcontainer) {
      return this.webcontainer;
    }

    if (!this.bootPromise) {
      this.bootPromise = WebContainer.boot();
    }

    this.webcontainer = await this.bootPromise;
    this._fs = new WebContainerFSAdapter(this.webcontainer);
    return this.webcontainer;
  }

  /**
   * Spawn a process in the WebContainer
   * Automatically boots the container on first call
   */
  async spawn(command: string, args: string[] = [], options: Record<string, unknown> = {}): Promise<WebContainerProcess> {
    const webcontainer = await this.ensureBooted();
    return webcontainer.spawn(command, args, options);
  }
}

/**
 * WebContainer filesystem adapter that implements JSRuntimeFS
 */
class WebContainerFSAdapter implements JSRuntimeFS {
  constructor(private webcontainer: WebContainer) {}

  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, encoding: 'utf8'): Promise<string>;
  async readFile(path: string, encoding: string): Promise<string>;
  async readFile(path: string, encoding?: string): Promise<string | Uint8Array>;
  async readFile(path: string, encoding?: string): Promise<string | Uint8Array> {
    if (encoding) {
      return this.webcontainer.fs.readFile(path, encoding as 'utf8');
    } else {
      return this.webcontainer.fs.readFile(path);
    }
  }

  async writeFile(path: string, data: string | Uint8Array, encoding?: string): Promise<void> {
    if (encoding) {
      return this.webcontainer.fs.writeFile(path, data, encoding as 'utf8');
    } else {
      return this.webcontainer.fs.writeFile(path, data);
    }
  }

  async readdir(path: string): Promise<string[]>;
  async readdir(path: string, options: { withFileTypes: true }): Promise<DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]> {
    if (options?.withFileTypes) {
      return this.webcontainer.fs.readdir(path, { withFileTypes: true });
    } else {
      return this.webcontainer.fs.readdir(path);
    }
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (options?.recursive) {
      await this.webcontainer.fs.mkdir(path, { recursive: true });
    } else {
      await this.webcontainer.fs.mkdir(path);
    }
  }

  async stat(path: string): Promise<{
    isDirectory(): boolean;
    isFile(): boolean;
    size?: number;
    mtimeMs?: number;
  }> {
    // WebContainer doesn't have a stat method, so we'll implement a workaround
    try {
      // Try to read as directory first
      await this.webcontainer.fs.readdir(path);
      return {
        isDirectory: () => true,
        isFile: () => false,
        size: undefined,
        mtimeMs: undefined,
      };
    } catch {
      // If readdir fails, assume it's a file
      try {
        const content = await this.webcontainer.fs.readFile(path) as string | Uint8Array;
        const size = typeof content === 'string' ? content.length : content.byteLength;
        return {
          isDirectory: () => false,
          isFile: () => true,
          size,
          mtimeMs: Date.now(), // WebContainer doesn't provide modification time
        };
      } catch {
        return {
          isDirectory: () => false,
          isFile: () => true,
          size: undefined,
          mtimeMs: undefined,
        };
      }
    }
  }

  async lstat(path: string): Promise<{
    isDirectory(): boolean;
    isFile(): boolean;
    size?: number;
    mtimeMs?: number;
  }> {
    // WebContainer doesn't have a lstat method, so we can use stat directly
    return this.stat(path);
  }

  async unlink(_path: string): Promise<void> {
    // WebContainer doesn't expose unlink, so we'll throw an error for now
    throw new Error('unlink operation not supported in WebContainer');
  }

  async rmdir(_path: string): Promise<void> {
    // WebContainer doesn't expose rmdir, so we'll throw an error for now
    throw new Error('rmdir operation not supported in WebContainer');
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    // WebContainer doesn't expose rename, so we'll implement it by copying and deleting
    const content = await this.webcontainer.fs.readFile(oldPath);
    await this.webcontainer.fs.writeFile(newPath, content);
    // Note: We can't delete the old file since WebContainer doesn't expose unlink
    console.warn('WebContainer rename: copied file but could not delete original');
  }

  async readlink(_path: string): Promise<string> {
    // WebContainer doesn't support symlinks, so we'll throw an error
    throw new Error('readlink operation not supported in WebContainer');
  }

  async symlink(_target: string, _path: string): Promise<void> {
    // WebContainer doesn't support symlinks, so we'll throw an error
    throw new Error('symlink operation not supported in WebContainer');
  }
}