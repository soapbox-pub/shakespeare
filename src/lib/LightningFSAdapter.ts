import type LightningFS from '@isomorphic-git/lightning-fs';
import type { JSRuntimeFS, DirectoryEntry } from './JSRuntime';

/**
 * LightningFS adapter that implements JSRuntimeFS interface
 * This makes LightningFS compatible with the unified filesystem interface
 */
export class LightningFSAdapter implements JSRuntimeFS {
  constructor(private lightningFS: LightningFS.PromisifiedFS) {}

  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, encoding: 'utf8'): Promise<string>;
  async readFile(path: string, encoding: string): Promise<string>;
  async readFile(path: string, encoding?: string): Promise<string | Uint8Array>;
  async readFile(path: string, encoding?: string): Promise<string | Uint8Array> {
    return this.lightningFS.readFile(path, encoding);
  }

  async writeFile(path: string, data: string | Uint8Array, encoding?: string): Promise<void> {
    return this.lightningFS.writeFile(path, data, encoding);
  }

  async readdir(path: string): Promise<string[]>;
  async readdir(path: string, options: { withFileTypes: true }): Promise<DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]> {
    if (options?.withFileTypes) {
      // LightningFS doesn't support withFileTypes, so we need to simulate it
      const items = await this.lightningFS.readdir(path);
      const entries: DirectoryEntry[] = [];

      for (const item of items) {
        const itemPath = `${path}/${item}`;
        try {
          const stat = await this.lightningFS.stat(itemPath);
          entries.push({
            name: item,
            isDirectory: stat.isDirectory.bind(stat),
            isFile: stat.isFile.bind(stat),
          });
        } catch {
          // If stat fails, assume it's a file
          entries.push({
            name: item,
            isDirectory: () => false,
            isFile: () => true,
          });
        }
      }

      return entries;
    } else {
      return this.lightningFS.readdir(path);
    }
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (options?.recursive) {
      // LightningFS doesn't support recursive option, so we need to create directories one by one
      const parts = path.split('/').filter(Boolean);
      let currentPath = path.startsWith('/') ? '/' : '';

      for (const part of parts) {
        currentPath = currentPath === '/' ? `/${part}` : `${currentPath}/${part}`;
        try {
          await this.lightningFS.mkdir(currentPath);
        } catch {
          // Directory might already exist, continue
        }
      }
    } else {
      return this.lightningFS.mkdir(path);
    }
  }

  async stat(path: string): Promise<{
    isDirectory(): boolean;
    isFile(): boolean;
    size?: number;
    mtimeMs?: number;
  }> {
    return this.lightningFS.stat(path);
  }

  async lstat(path: string): Promise<{
    isDirectory(): boolean;
    isFile(): boolean;
    size?: number;
    mtimeMs?: number;
  }> {
    return this.lightningFS.lstat(path);
  }

  async unlink(path: string): Promise<void> {
    return this.lightningFS.unlink(path);
  }

  async rmdir(path: string): Promise<void> {
    return this.lightningFS.rmdir(path);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    return this.lightningFS.rename(oldPath, newPath);
  }
}