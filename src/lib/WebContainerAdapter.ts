import { WebContainer, type WebContainerProcess, type FileSystemTree } from '@webcontainer/api';
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

  /**
   * Mount a file tree in the WebContainer
   * This is a convenience method for setting up the container
   */
  async mount(tree: FileSystemTree): Promise<void> {
    const webcontainer = await this.ensureBooted();
    return webcontainer.mount(tree);
  }
}

/**
 * WebContainer filesystem adapter that implements JSRuntimeFS
 */
class WebContainerFSAdapter implements JSRuntimeFS {
  constructor(private webcontainer: WebContainer) {}

  async readFile(path: string, encoding?: string): Promise<string | Uint8Array> {
    if (encoding) {
      return this.webcontainer.fs.readFile(path, encoding as 'utf8');
    } else {
      return this.webcontainer.fs.readFile(path);
    }
  }

  async writeFile(path: string, data: string | Uint8Array): Promise<void> {
    return this.webcontainer.fs.writeFile(path, data);
  }

  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]> {
    if (options?.withFileTypes) {
      return this.webcontainer.fs.readdir(path, { withFileTypes: true }) as Promise<DirectoryEntry[]>;
    } else {
      return this.webcontainer.fs.readdir(path) as Promise<string[]>;
    }
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (options?.recursive) {
      await this.webcontainer.fs.mkdir(path, { recursive: true });
    } else {
      await this.webcontainer.fs.mkdir(path);
    }
  }

  async stat(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean }> {
    // WebContainer doesn't have a stat method, so we'll implement a workaround
    try {
      // Try to read as directory first
      await this.webcontainer.fs.readdir(path);
      return {
        isDirectory: () => true,
        isFile: () => false,
      };
    } catch {
      // If readdir fails, assume it's a file
      return {
        isDirectory: () => false,
        isFile: () => true,
      };
    }
  }
}