import { mkdtempSync, rmSync } from 'node:fs';
import * as fsp from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DirectoryEntry, JSRuntimeFS } from '@/lib/JSRuntime';

/**
 * JSRuntimeFS backed by a real temporary directory, for tests that need
 * genuine filesystem semantics. Virtual paths are mapped under the root.
 */
export class HostFS implements JSRuntimeFS {
  readonly root = mkdtempSync(join(tmpdir(), 'shakespeare-fs-'));

  private host(path: string): string {
    return join(this.root, path);
  }

  /** Create files (and their parent directories) from a path → content map. */
  async seed(files: Record<string, string>): Promise<void> {
    for (const [path, content] of Object.entries(files)) {
      await fsp.mkdir(join(this.host(path), '..'), { recursive: true });
      await fsp.writeFile(this.host(path), content);
    }
  }

  async mkdirp(path: string): Promise<void> {
    await fsp.mkdir(this.host(path), { recursive: true });
  }

  dispose(): void {
    rmSync(this.root, { recursive: true, force: true });
  }

  readFile(path: string): Promise<Uint8Array>;
  readFile(path: string, options: 'utf8'): Promise<string>;
  readFile(path: string, options: string): Promise<string>;
  readFile(path: string, options: { encoding: 'utf8' }): Promise<string>;
  readFile(path: string, options: { encoding: string }): Promise<string>;
  readFile(path: string, options?: string | { encoding?: string }): Promise<string | Uint8Array>;
  async readFile(path: string, options?: string | { encoding?: string }): Promise<string | Uint8Array> {
    const encoding = typeof options === 'string' ? options : options?.encoding;
    const data = await fsp.readFile(this.host(path));
    return encoding ? data.toString(encoding as BufferEncoding) : new Uint8Array(data);
  }

  async writeFile(path: string, data: string | Uint8Array): Promise<void> {
    await fsp.writeFile(this.host(path), data);
  }

  readdir(path: string): Promise<string[]>;
  readdir(path: string, options: { withFileTypes: true }): Promise<DirectoryEntry[]>;
  readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]> {
    if (options?.withFileTypes) return fsp.readdir(this.host(path), { withFileTypes: true });
    return fsp.readdir(this.host(path));
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await fsp.mkdir(this.host(path), options);
  }

  stat(path: string) {
    return fsp.stat(this.host(path));
  }

  lstat(path: string) {
    return fsp.lstat(this.host(path));
  }

  unlink(path: string) {
    return fsp.unlink(this.host(path));
  }

  rmdir(path: string) {
    return fsp.rmdir(this.host(path));
  }

  rename(oldPath: string, newPath: string) {
    return fsp.rename(this.host(oldPath), this.host(newPath));
  }

  readlink(path: string) {
    return fsp.readlink(this.host(path));
  }

  symlink(target: string, path: string) {
    return fsp.symlink(target, this.host(path));
  }
}
