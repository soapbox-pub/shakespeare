import { dirname, join, normalize } from 'path-browserify';
import type {
  BufferEncoding,
  CpOptions,
  FileContent,
  FsStat,
  IFileSystem,
  MkdirOptions,
  RmOptions,
} from 'just-bash/browser';
import type { JSRuntimeFS } from '../JSRuntime';
import { isWriteAllowed } from '../security';

type ReadFileOptions = Exclude<Parameters<IFileSystem['readFile']>[1], BufferEncoding | undefined>;
type WriteFileOptions = Exclude<Parameters<IFileSystem['writeFile']>[2], BufferEncoding | undefined>;
type DirentEntry = Awaited<ReturnType<NonNullable<IFileSystem['readdirWithFileTypes']>>>[number];
type EncodingOption = ReadFileOptions | WriteFileOptions | BufferEncoding | undefined;

/** Device files that exist without being stored. Writes to them are discarded. */
const DEVICES = new Set(['/dev/null', '/dev/zero', '/dev/stdin', '/dev/stdout', '/dev/stderr']);

/** Directories where just-bash looks commands up (`which`, `command -v`, `/bin/ls`). */
const BIN_DIRS = new Set(['/bin', '/usr/bin']);

/**
 * just-bash filesystem backed by Shakespeare's VFS.
 *
 * Reads may go anywhere; anything that modifies the filesystem is limited to
 * the project, other projects, and /tmp (see isWriteAllowed). Errors use
 * Node's `CODE: message, op 'path'` form, which just-bash's commands parse.
 *
 * /dev/null and friends, and /bin and /usr/bin (listing the shell's
 * commands), are virtual.
 */
export class BashFS implements IFileSystem {
  /** Modes set with chmod. The VFS has no permission bits, so they last for the session. */
  private modes = new Map<string, number>();

  constructor(
    private fs: JSRuntimeFS,
    private projectRoot: string,
    private commandNames: () => string[] = () => [],
  ) {}

  /** 'dir' for a virtual bin directory, 'file' for a command in one. */
  private virtual(path: string): 'dir' | 'file' | 'device' | undefined {
    if (DEVICES.has(path)) return 'device';
    if (BIN_DIRS.has(path)) return 'dir';
    const parent = dirname(path);
    if (BIN_DIRS.has(parent) && this.commandNames().includes(path.slice(parent.length + 1))) return 'file';
    return undefined;
  }

  async readFile(path: string, options?: ReadFileOptions | BufferEncoding): Promise<string> {
    return decode(await this.readFileBuffer(path), encodingOf(options));
  }

  async readFileBuffer(path: string): Promise<Uint8Array> {
    const st = await this.statRaw(path, 'open');
    if (st.isDirectory()) throw fsError('EISDIR', 'illegal operation on a directory', 'read', path);
    if (this.virtual(path)) return new Uint8Array(0);
    const data = await this.call('open', path, () => this.fs.readFile(path));
    return typeof data === 'string' ? new TextEncoder().encode(data) : data;
  }

  /**
   * Write a file, creating missing parent directories like just-bash's own
   * filesystems do. Its redirection code doesn't handle a failed write.
   */
  async writeFile(path: string, content: FileContent, options?: WriteFileOptions | BufferEncoding): Promise<void> {
    if (this.virtual(path) === 'device') return;
    this.checkWrite(path, 'open');
    await this.mkdir(dirname(path), { recursive: true });
    await this.call('open', path, () => this.fs.writeFile(path, encode(content, encodingOf(options))));
  }

  async appendFile(path: string, content: FileContent, options?: WriteFileOptions | BufferEncoding): Promise<void> {
    if (this.virtual(path) === 'device') return;
    this.checkWrite(path, 'open');
    const existing = await this.exists(path) ? await this.readFileBuffer(path) : new Uint8Array(0);
    const added = encode(content, encodingOf(options));
    const merged = new Uint8Array(existing.length + added.length);
    merged.set(existing);
    merged.set(added, existing.length);
    await this.writeFile(path, merged);
  }

  async exists(path: string): Promise<boolean> {
    if (this.virtual(path)) return true;
    try {
      await this.fs.stat(path);
      return true;
    } catch {
      return false;
    }
  }

  async stat(path: string): Promise<FsStat> {
    return this.toFsStat(path, await this.statRaw(path, 'stat'), false);
  }

  async lstat(path: string): Promise<FsStat> {
    if (this.virtual(path)) return this.stat(path);
    const st = await this.call('lstat', path, () => this.fs.lstat(path));
    return this.toFsStat(path, st, isSymbolicLink(st));
  }

  async mkdir(path: string, options?: MkdirOptions): Promise<void> {
    if (await this.exists(path)) {
      if (options?.recursive && (await this.stat(path)).isDirectory) return;
      throw fsError('EEXIST', 'file already exists', 'mkdir', path);
    }
    this.checkWrite(path, 'mkdir');
    const parent = dirname(path);
    if (!(await this.exists(parent))) {
      if (!options?.recursive) throw fsError('ENOENT', 'no such file or directory', 'mkdir', path);
      await this.mkdir(parent, { recursive: true });
    } else if (!(await this.stat(parent)).isDirectory) {
      throw fsError('ENOTDIR', 'not a directory', 'mkdir', path);
    }
    await this.call('mkdir', path, () => this.fs.mkdir(path));
  }

  async readdir(path: string): Promise<string[]> {
    const st = await this.statRaw(path, 'scandir');
    if (!st.isDirectory()) throw fsError('ENOTDIR', 'not a directory', 'scandir', path);
    if (this.virtual(path)) return [...this.commandNames()].sort();
    const names = await this.call('scandir', path, () => this.fs.readdir(path));
    return [...names].sort();
  }

  async readdirWithFileTypes(path: string): Promise<DirentEntry[]> {
    const st = await this.statRaw(path, 'scandir');
    if (!st.isDirectory()) throw fsError('ENOTDIR', 'not a directory', 'scandir', path);
    if (this.virtual(path)) {
      return (await this.readdir(path)).map((name) => ({ name, isFile: true, isDirectory: false, isSymbolicLink: false }));
    }
    const entries = await this.call('scandir', path, () => this.fs.readdir(path, { withFileTypes: true }));
    return entries
      .map((e) => ({
        name: e.name,
        isFile: e.isFile(),
        isDirectory: e.isDirectory(),
        isSymbolicLink: isSymbolicLink(e),
      }))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }

  async rm(path: string, options?: RmOptions): Promise<void> {
    this.checkWrite(path, 'rm');
    let st;
    try {
      st = await this.lstat(path);
    } catch (error) {
      if (options?.force) return;
      throw error;
    }
    if (st.isDirectory) {
      const children = await this.readdir(path);
      if (children.length > 0 && !options?.recursive) {
        throw fsError('ENOTEMPTY', 'directory not empty', 'rm', path);
      }
      for (const child of children) {
        await this.rm(join(path, child), { recursive: true, force: options?.force });
      }
      await this.call('rmdir', path, () => this.fs.rmdir(path));
    } else {
      await this.call('unlink', path, () => this.fs.unlink(path));
    }
    this.modes.delete(path);
  }

  async cp(src: string, dest: string, options?: CpOptions): Promise<void> {
    this.checkWrite(dest, 'cp');
    const st = await this.stat(src);
    if (st.isDirectory) {
      if (!options?.recursive) throw fsError('EISDIR', 'illegal operation on a directory', 'cp', src);
      if (dest === src || dest.startsWith(`${src}/`)) {
        throw fsError('EINVAL', 'cannot copy a directory into itself', 'cp', dest);
      }
      await this.mkdir(dest, { recursive: true });
      for (const child of await this.readdir(src)) {
        await this.cp(join(src, child), join(dest, child), options);
      }
    } else {
      await this.writeFile(dest, await this.readFileBuffer(src));
    }
  }

  async mv(src: string, dest: string): Promise<void> {
    this.checkWrite(src, 'rename');
    this.checkWrite(dest, 'rename');
    await this.stat(src);
    const parent = dirname(dest);
    if (!(await this.exists(parent))) throw fsError('ENOENT', 'no such file or directory', 'rename', dest);
    if (!(await this.stat(parent)).isDirectory) throw fsError('ENOTDIR', 'not a directory', 'rename', dest);
    if (await this.exists(dest)) {
      const destStat = await this.stat(dest);
      if (destStat.isDirectory) {
        throw fsError('EISDIR', 'illegal operation on a directory', 'rename', dest);
      }
      await this.rm(dest);
    }
    await this.call('rename', src, () => this.fs.rename(src, dest));
  }

  resolvePath(base: string, path: string): string {
    return normalize(path.startsWith('/') ? path : join(base, path));
  }

  getAllPaths(): string[] {
    return [];
  }

  async chmod(path: string, mode: number): Promise<void> {
    this.checkWrite(path, 'chmod');
    await this.stat(path);
    this.modes.set(path, mode & 0o7777);
  }

  async symlink(target: string, linkPath: string): Promise<void> {
    this.checkWrite(linkPath, 'symlink');
    if (await this.exists(linkPath)) throw fsError('EEXIST', 'file already exists', 'symlink', linkPath);
    await this.call('symlink', linkPath, () => this.fs.symlink(target, linkPath));
  }

  async link(existingPath: string, newPath: string): Promise<void> {
    void existingPath;
    throw fsError('EPERM', 'hard links are not supported; use cp or ln -s', 'link', newPath);
  }

  async readlink(path: string): Promise<string> {
    return this.call('readlink', path, () => this.fs.readlink(path));
  }

  async realpath(path: string): Promise<string> {
    let current = normalize(path);
    for (let i = 0; i < 40; i++) {
      const st = await this.lstat(current);
      if (!st.isSymbolicLink) return current;
      const target = await this.readlink(current);
      current = this.resolvePath(dirname(current), target);
    }
    throw fsError('ELOOP', 'too many symbolic links encountered', 'realpath', path);
  }

  async utimes(path: string): Promise<void> {
    // The VFS can't set times; touch on an existing file is a no-op.
    await this.stat(path);
  }

  private checkWrite(path: string, op: string): void {
    if (this.virtual(path) === 'device') return;
    if (!isWriteAllowed(path, this.projectRoot)) {
      throw fsError('EACCES', 'permission denied (writes are only allowed in the project and /tmp)', op, path);
    }
  }

  private async statRaw(path: string, op: string) {
    const kind = this.virtual(path);
    if (kind) {
      const isDirectory = kind === 'dir';
      return { isDirectory: () => isDirectory, isFile: () => !isDirectory, size: 0, mtimeMs: 0 };
    }
    return this.call(op, path, () => this.fs.stat(path));
  }

  private toFsStat(
    path: string,
    st: { isDirectory(): boolean; isFile(): boolean; size?: number; mtimeMs?: number },
    isSymbolicLink: boolean,
  ): FsStat {
    const isDirectory = !isSymbolicLink && st.isDirectory();
    const executable = isSymbolicLink || isDirectory || this.virtual(path) === 'file';
    const defaultMode = executable ? (isSymbolicLink ? 0o777 : 0o755) : 0o644;
    const typeBits = isSymbolicLink ? 0o120000 : isDirectory ? 0o040000 : 0o100000;
    return {
      isFile: !isSymbolicLink && st.isFile(),
      isDirectory,
      isSymbolicLink,
      mode: typeBits | (this.modes.get(path) ?? defaultMode),
      size: st.size ?? 0,
      mtime: new Date(st.mtimeMs ?? Date.now()),
    };
  }

  /** Run a VFS call, rethrowing its errors in Node's message format. */
  private async call<T>(op: string, path: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw normalizeError(error, op, path);
    }
  }
}

const MESSAGES: Record<string, string> = {
  ENOENT: 'no such file or directory',
  EEXIST: 'file already exists',
  ENOTDIR: 'not a directory',
  EISDIR: 'illegal operation on a directory',
  ENOTEMPTY: 'directory not empty',
  EACCES: 'permission denied',
  EINVAL: 'invalid argument',
};

/** The VFS types don't declare isSymbolicLink, but LightningFS stats and dirents have it. */
function isSymbolicLink(entry: object): boolean {
  const fn = (entry as { isSymbolicLink?: unknown }).isSymbolicLink;
  return typeof fn === 'function' && fn.call(entry) === true;
}

function fsError(code: string, message: string, op: string, path: string): Error {
  return Object.assign(new Error(`${code}: ${message}, ${op} '${path}'`), { code });
}

function normalizeError(error: unknown, op: string, path: string): Error {
  const code = (error as { code?: unknown })?.code;
  const message = error instanceof Error ? error.message : String(error);
  const found = typeof code === 'string' ? code : /^(E[A-Z]+)\b/.exec(message)?.[1];
  if (found) return fsError(found, MESSAGES[found] ?? message.replace(/^E[A-Z]+:?\s*/, ''), op, path);
  return error instanceof Error ? error : new Error(message);
}

function encodingOf(options: EncodingOption): BufferEncoding {
  const encoding = typeof options === 'string' ? options : options?.encoding;
  return encoding ?? 'utf8';
}

function decode(bytes: Uint8Array, encoding: BufferEncoding): string {
  switch (encoding) {
    case 'binary':
    case 'latin1': {
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      return s;
    }
    case 'ascii':
      return decode(bytes.map((b) => b & 0x7f), 'latin1');
    case 'base64':
      return btoa(decode(bytes, 'latin1'));
    case 'hex':
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    default:
      return new TextDecoder().decode(bytes);
  }
}

function encode(content: FileContent, encoding: BufferEncoding): Uint8Array {
  // Not instanceof: bytes from another realm (a worker, jsdom) would fail it.
  if (typeof content !== 'string') return new Uint8Array(content);
  switch (encoding) {
    case 'binary':
    case 'latin1':
    case 'ascii':
      return Uint8Array.from(content, (c) => c.charCodeAt(0) & 0xff);
    case 'base64':
      return encode(atob(content), 'latin1');
    case 'hex': {
      const out = new Uint8Array(content.length >> 1);
      for (let i = 0; i < out.length; i++) out[i] = parseInt(content.slice(i * 2, i * 2 + 2), 16);
      return out;
    }
    default:
      return new TextEncoder().encode(content);
  }
}
