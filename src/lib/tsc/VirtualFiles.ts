import type { PackageFiles } from './packages';

/** Collapse `.`/`..` segments and duplicate slashes in an absolute path. */
export function normalizePath(path: string, cwd = '/'): string {
  const parts: string[] = [];
  for (const part of (path.startsWith('/') ? path : `${cwd}/${path}`).split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return `/${parts.join('/')}`;
}

function parentOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i <= 0 ? '/' : path.slice(0, i);
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/**
 * Find the innermost package directory a project-relative path falls inside,
 * e.g. `node_modules/a/node_modules/@s/b/dist/x.d.ts` -> `node_modules/a/node_modules/@s/b`.
 */
export function packageKeyOf(rel: string): string | undefined {
  const segments = rel.split('/');
  let key: string | undefined;
  let i = 0;
  while (segments[i] === 'node_modules') {
    const scoped = segments[i + 1]?.startsWith('@');
    const end = i + (scoped ? 3 : 2);
    if (segments.length < end || !segments[end - 1]) break;
    key = segments.slice(0, end).join('/');
    i = end;
  }
  return key;
}

interface Directory {
  dirs: Set<string>;
  files: Set<string>;
}

/**
 * An in-memory file tree for the compiler, overlaid with the packages of a
 * lockfile that have not been downloaded yet.
 *
 * TypeScript's file system calls are synchronous, so missing packages can't be
 * fetched on demand. Instead, unfetched lockfile packages appear as empty
 * directories, and any access inside one is recorded in `wanted`. The caller
 * downloads those and runs the compiler again until nothing new is wanted.
 */
export class VirtualFiles {
  private files = new Map<string, string>();
  private stubs = new Set<string>();
  private tree = new Map<string, Directory>([['/', { dirs: new Set(), files: new Set() }]]);

  /** Lockfile packages (project-relative keys) that haven't been mounted. */
  private lazy = new Set<string>();
  private lazyTree = new Map<string, Set<string>>();
  private mounted = new Set<string>();

  /** Lockfile packages the compiler tried to read. */
  readonly wanted = new Set<string>();
  /** Top-level packages the compiler looked for that the lockfile doesn't have. */
  readonly missing = new Set<string>();

  constructor(readonly root: string) {}

  private ensureDir(path: string): Directory {
    let dir = this.tree.get(path);
    if (!dir) {
      dir = { dirs: new Set(), files: new Set() };
      this.tree.set(path, dir);
      if (path !== '/') this.ensureDir(parentOf(path)).dirs.add(baseName(path));
    }
    return dir;
  }

  writeFile(path: string, text: string): void {
    this.files.set(path, text);
    this.ensureDir(parentOf(path)).files.add(baseName(path));
  }

  private addStub(path: string): void {
    this.stubs.add(path);
    this.ensureDir(parentOf(path)).files.add(baseName(path));
  }

  deleteFile(path: string): void {
    this.files.delete(path);
    this.tree.get(parentOf(path))?.files.delete(baseName(path));
  }

  createDirectory(path: string): void {
    this.ensureDir(path);
  }

  /** Register a lockfile package as available but not yet downloaded. */
  addLazyPackage(key: string): void {
    if (this.mounted.has(key)) return;
    this.lazy.add(key);
    let path = `${this.root}/${key}`;
    while (path.startsWith(`${this.root}/`)) {
      const parent = parentOf(path);
      let children = this.lazyTree.get(parent);
      if (!children) {
        children = new Set();
        this.lazyTree.set(parent, children);
      }
      children.add(baseName(path));
      path = parent;
    }
  }

  /** Make a package's files visible at `dir` (absolute). */
  mount(dir: string, pkg: PackageFiles, key?: string): void {
    this.ensureDir(dir);
    for (const [rel, text] of Object.entries(pkg.files)) this.writeFile(`${dir}/${rel}`, text);
    for (const rel of pkg.stubs) this.addStub(`${dir}/${rel}`);
    if (key) {
      this.lazy.delete(key);
      this.mounted.add(key);
    }
  }

  isMounted(key: string): boolean {
    return this.mounted.has(key);
  }

  mountedKeys(): string[] {
    return [...this.mounted];
  }

  private touch(path: string): void {
    if (!path.startsWith(`${this.root}/`)) return;
    const key = packageKeyOf(path.slice(this.root.length + 1));
    if (!key || this.mounted.has(key)) return;
    if (this.lazy.has(key)) {
      this.wanted.add(key);
    } else if (key.split('/').length <= 3) {
      this.missing.add(key.slice('node_modules/'.length));
    }
  }

  fileExists(path: string): boolean {
    this.touch(path);
    return this.files.has(path) || this.stubs.has(path);
  }

  readFile(path: string): string | undefined {
    this.touch(path);
    return this.files.get(path) ?? (this.stubs.has(path) ? '' : undefined);
  }

  getFileSize(path: string): number {
    return this.files.get(path)?.length ?? 0;
  }

  directoryExists(path: string): boolean {
    this.touch(path);
    return this.tree.has(path) || this.lazyTree.has(path) || this.lazy.has(path.slice(this.root.length + 1));
  }

  getDirectories(path: string): string[] {
    const dirs = new Set(this.tree.get(path)?.dirs);
    for (const name of this.lazyTree.get(path) ?? []) dirs.add(name);
    return [...dirs];
  }

  getEntries(path: string): { files: string[]; directories: string[] } {
    this.touch(path);
    return { files: [...(this.tree.get(path)?.files ?? [])], directories: this.getDirectories(path) };
  }
}
