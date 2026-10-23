import ignore, { type Ignore } from 'ignore';
import { normalize } from 'path-browserify';
import type { JSRuntimeFS } from '../../JSRuntime';
import type { Git } from '../../git';
import type { ShellCommandResult } from '../ShellCommand';
import type { FileVersion, Snapshot } from './diffing';
import { abbrev, matchesPathspec, readIndex, type TreeEntryInfo } from './revisions';

export const NOT_A_REPO = 'fatal: not a git repository (or any of the parent directories): .git';

export async function isRepo(fs: JSRuntimeFS, dir: string): Promise<boolean> {
  try {
    await fs.stat(`${dir}/.git`);
    return true;
  } catch {
    return false;
  }
}

/** A result with both streams, the way git splits its output. */
export function output(stdout: string, stderr = '', exitCode = 0): ShellCommandResult {
  return { exitCode, stdout, stderr };
}

/** `fatal:` errors exit 128, as in git. */
export function fatal(message: string): ShellCommandResult {
  return { exitCode: 128, stdout: '', stderr: message.startsWith('fatal:') ? message : `fatal: ${message}` };
}

export function pathspecDidNotMatch(spec: string): string {
  return `error: pathspec '${spec}' did not match any file(s) known to git`;
}

export const SEPARATE_PATHS_HINT = "Use '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'";

/**
 * A command-line path as a path relative to the repository root (`''` for the
 * root itself), or null when it points outside the repository.
 */
export function repoPath(dir: string, arg: string): string | null {
  let path = arg;
  if (path.startsWith('/')) {
    const root = dir.replace(/\/+$/, '');
    if (path.replace(/\/+$/, '') === root) return '';
    if (!path.startsWith(`${root}/`)) return null;
    path = path.slice(root.length + 1);
  }
  if (path === '') return '';
  path = normalize(path).replace(/\/+$/, '');
  if (path === '.' || path === '') return '';
  if (path === '..' || path.startsWith('../')) return null;
  return path;
}

export function outsideRepository(arg: string, dir: string): string {
  return `fatal: ${arg}: '${arg}' is outside repository at '${dir}'`;
}

/** Normalize pathspec arguments; returns an error result for one outside the repository. */
export function normalizePathspecs(dir: string, args: string[]): { specs: string[] } | { error: ShellCommandResult } {
  const specs: string[] = [];
  for (const arg of args) {
    const path = repoPath(dir, arg);
    if (path === null) return { error: fatal(outsideRepository(arg, dir)) };
    specs.push(path === '' ? '.' : path);
  }
  return { specs };
}

export function matchesAny(path: string, spec: string): boolean {
  return matchesPathspec(path, [spec]);
}

export interface PathStatus {
  path: string;
  /** HEAD → index: ' ' (unchanged), 'A', 'M' or 'D'. */
  staged: ' ' | 'A' | 'M' | 'D';
  /** index → working tree: ' ', 'M' or 'D'. */
  unstaged: ' ' | 'M' | 'D';
  /** In the working tree but not the index. */
  untracked: boolean;
  inHead: boolean;
  inIndex: boolean;
  inWorktree: boolean;
}

/**
 * The status of every path that is in HEAD, the index, or (unignored) the working tree.
 *
 * isomorphic-git trusts the index's stat data at one-second resolution, so a
 * same-size edit made in the same second as the index was written looks
 * unchanged. Like git's "racily clean" check, files modified no earlier than
 * the index are re-hashed.
 */
export async function readStatus(git: Git, fs: JSRuntimeFS, dir: string): Promise<PathStatus[]> {
  const rows = await git.statusMatrix({ dir });
  let indexMtime: number | undefined;
  try {
    indexMtime = (await fs.stat(`${dir}/.git/index`)).mtimeMs;
  } catch {
    indexMtime = undefined;
  }
  let index: Map<string, TreeEntryInfo> | undefined;

  const out: PathStatus[] = [];
  for (const [path, head, workdir, stage] of rows) {
    let staged: PathStatus['staged'] = ' ';
    if (head === 0 && stage !== 0) staged = 'A';
    else if (head === 1 && stage === 0) staged = 'D';
    else if (head === 1 && stage !== 1) staged = 'M';

    let unstaged: PathStatus['unstaged'] = ' ';
    if (stage !== 0) {
      if (workdir === 0) unstaged = 'D';
      else if (stage === 3 || (stage === 1 && workdir === 2)) unstaged = 'M';
    }

    if (stage !== 0 && workdir !== 0 && unstaged === ' ' && indexMtime !== undefined) {
      try {
        const mtime = (await fs.stat(`${dir}/${path}`)).mtimeMs;
        if (mtime !== undefined && Math.floor(mtime / 1000) >= Math.floor(indexMtime / 1000)) {
          index ??= await readIndex(git, dir);
          const content = await fs.readFile(`${dir}/${path}`);
          const { oid } = await git.hashBlob({ object: content });
          if (index.get(path) && oid !== index.get(path)!.oid) unstaged = 'M';
        }
      } catch {
        // Unreadable; trust the matrix.
      }
    }

    out.push({
      path,
      staged,
      unstaged,
      untracked: stage === 0 && workdir !== 0,
      inHead: head === 1,
      inIndex: stage !== 0,
      inWorktree: workdir !== 0,
    });
  }
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** Every directory that holds a tracked file. */
export function trackedDirectories(paths: Iterable<string>): Set<string> {
  const dirs = new Set<string>();
  for (const path of paths) {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
  }
  return dirs;
}

/**
 * Collapse untracked files into their topmost wholly untracked directory
 * (`dir/`), the way `git status` shows them by default.
 */
export function collapseUntracked(untracked: string[], tracked: Iterable<string>): string[] {
  const dirs = trackedDirectories(tracked);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const path of untracked) {
    const parts = path.split('/');
    let shown = path;
    for (let i = 1; i < parts.length; i++) {
      const dirPath = parts.slice(0, i).join('/');
      if (!dirs.has(dirPath)) {
        shown = `${dirPath}/`;
        break;
      }
    }
    if (!seen.has(shown)) {
      seen.add(shown);
      out.push(shown);
    }
  }
  return out.sort();
}

interface IgnoreRules {
  base: string;
  ig: Ignore;
}

export interface WorktreeListing {
  /** Files that are not ignored. */
  files: string[];
  /** Ignored files, plus ignored directories (with a trailing slash) that were not descended into. */
  ignored: string[];
}

/**
 * Walk the working tree (outside `.git`), applying `.gitignore` files and
 * `.git/info/exclude`. Ignored directories are reported, not descended into.
 */
export async function listWorktree(fs: JSRuntimeFS, dir: string): Promise<WorktreeListing> {
  const listing: WorktreeListing = { files: [], ignored: [] };
  const rules: IgnoreRules[] = [];
  try {
    rules.push({ base: '', ig: ignore().add(await fs.readFile(`${dir}/.git/info/exclude`, 'utf8')) });
  } catch {
    // No exclude file.
  }

  const isIgnored = (path: string, stack: IgnoreRules[]): boolean => {
    let ignored = false;
    for (const { base, ig } of stack) {
      if (base && !path.startsWith(`${base}/`)) continue;
      const rel = base ? path.slice(base.length + 1) : path;
      const result = ig.test(rel);
      if (result.ignored) ignored = true;
      else if (result.unignored) ignored = false;
    }
    return ignored;
  };

  const walk = async (rel: string, stack: IgnoreRules[]): Promise<void> => {
    const abs = rel ? `${dir}/${rel}` : dir;
    let entries;
    try {
      entries = await fs.readdir(abs, { withFileTypes: true });
    } catch {
      return;
    }
    let local = stack;
    if (entries.some((e) => e.name === '.gitignore' && !e.isDirectory())) {
      try {
        local = [...stack, { base: rel, ig: ignore().add(await fs.readFile(`${abs}/.gitignore`, 'utf8')) }];
      } catch {
        // Unreadable; ignore it.
      }
    }
    const sorted = [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of sorted) {
      if (entry.name === '.git') continue;
      const path = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (isIgnored(`${path}/`, local)) listing.ignored.push(`${path}/`);
        else await walk(path, local);
      } else if (isIgnored(path, local)) {
        listing.ignored.push(path);
      } else {
        listing.files.push(path);
      }
    }
  };

  await walk('', rules);
  listing.files.sort();
  listing.ignored.sort();
  return listing;
}

/** Whether a path exists in the working tree (as a file or directory). */
export async function exists(fs: JSRuntimeFS, path: string): Promise<boolean> {
  try {
    await fs.lstat(path);
    return true;
  } catch {
    return false;
  }
}

/** Write a blob into the working tree, creating parent directories. */
export async function writeWorktreeFile(git: Git, fs: JSRuntimeFS, dir: string, path: string, oid: string): Promise<void> {
  const slash = path.lastIndexOf('/');
  if (slash !== -1) await fs.mkdir(`${dir}/${path.slice(0, slash)}`, { recursive: true });
  const { blob } = await git.readBlob({ dir, oid });
  await fs.writeFile(`${dir}/${path}`, blob);
}

/** Delete a file from the working tree, and any parent directories it leaves empty. */
export async function removeWorktreeFile(fs: JSRuntimeFS, dir: string, path: string): Promise<void> {
  try {
    await fs.unlink(`${dir}/${path}`);
  } catch {
    return;
  }
  const parts = path.split('/');
  for (let i = parts.length - 1; i > 0; i--) {
    const parent = `${dir}/${parts.slice(0, i).join('/')}`;
    try {
      if ((await fs.readdir(parent)).length > 0) break;
      await fs.rmdir(parent);
    } catch {
      break;
    }
  }
}

/** Set (or, with no version, delete) a path's index entry without touching the working tree. */
export async function setIndexEntry(git: Git, dir: string, path: string, version: FileVersion | undefined): Promise<void> {
  if (!version) {
    await git.remove({ dir, filepath: path });
    return;
  }
  await git.updateIndex({ dir, filepath: path, oid: version.oid, mode: parseInt(version.mode, 8), add: true });
}

export function toSnapshot(entries: Map<string, TreeEntryInfo>): Snapshot {
  const snapshot: Snapshot = new Map();
  for (const [path, entry] of entries) snapshot.set(path, { oid: entry.oid, mode: entry.mode });
  return snapshot;
}

export async function readIndexSnapshot(git: Git, dir: string): Promise<Snapshot> {
  return toSnapshot(await readIndex(git, dir));
}

/** The current branch's short name, or undefined when HEAD is detached. */
export async function currentBranch(git: Git, dir: string): Promise<string | undefined> {
  try {
    return (await git.currentBranch({ dir, fullname: false })) || undefined;
  } catch {
    return undefined;
  }
}

export async function headOid(git: Git, dir: string): Promise<string | undefined> {
  try {
    return await git.resolveRef({ dir, ref: 'HEAD' });
  } catch {
    return undefined;
  }
}

export async function branchExists(git: Git, dir: string, name: string): Promise<boolean> {
  try {
    await git.resolveRef({ dir, ref: `refs/heads/${name}` });
    return true;
  } catch {
    return false;
  }
}

export async function commitSubject(git: Git, dir: string, oid: string): Promise<string> {
  const { commit } = await git.readCommit({ dir, oid });
  return commit.message.split('\n')[0];
}

/** `HEAD is now at <abbrev> <subject>` */
export async function headIsNowAt(git: Git, dir: string, oid: string): Promise<string> {
  return `HEAD is now at ${abbrev(oid)} ${await commitSubject(git, dir, oid)}`;
}

/** The upstream tracking ref of a branch (`refs/remotes/origin/main`), if one is configured. */
export async function upstreamOf(git: Git, dir: string, branch: string): Promise<{ ref: string; name: string } | undefined> {
  const remote = await git.getConfig({ dir, path: `branch.${branch}.remote` }) as string | undefined;
  const merge = await git.getConfig({ dir, path: `branch.${branch}.merge` }) as string | undefined;
  if (!remote || !merge) return undefined;
  const short = merge.replace(/^refs\/heads\//, '');
  if (remote === '.') return { ref: `refs/heads/${short}`, name: short };
  return { ref: `refs/remotes/${remote}/${short}`, name: `${remote}/${short}` };
}

async function ancestors(git: Git, dir: string, oid: string): Promise<Set<string>> {
  const seen = new Set<string>();
  const queue = [oid];
  while (queue.length > 0) {
    const next = queue.pop()!;
    if (seen.has(next)) continue;
    seen.add(next);
    try {
      const { commit } = await git.readCommit({ dir, oid: next });
      queue.push(...commit.parent);
    } catch {
      // Missing object (shallow clone).
    }
  }
  return seen;
}

/** Commits on `local` but not `upstream`, and vice versa. */
export async function aheadBehind(git: Git, dir: string, local: string, upstream: string): Promise<{ ahead: number; behind: number }> {
  if (local === upstream) return { ahead: 0, behind: 0 };
  const [a, b] = await Promise.all([ancestors(git, dir, local), ancestors(git, dir, upstream)]);
  let ahead = 0;
  let behind = 0;
  for (const oid of a) if (!b.has(oid)) ahead++;
  for (const oid of b) if (!a.has(oid)) behind++;
  return { ahead, behind };
}

export interface Tracking {
  upstream: string;
  gone: boolean;
  ahead: number;
  behind: number;
}

export async function trackingInfo(git: Git, dir: string, branch: string): Promise<Tracking | undefined> {
  const upstream = await upstreamOf(git, dir, branch);
  if (!upstream) return undefined;
  let upstreamOid: string;
  let localOid: string;
  try {
    localOid = await git.resolveRef({ dir, ref: `refs/heads/${branch}` });
  } catch {
    return undefined;
  }
  try {
    upstreamOid = await git.resolveRef({ dir, ref: upstream.ref });
  } catch {
    return { upstream: upstream.name, gone: true, ahead: 0, behind: 0 };
  }
  return { upstream: upstream.name, gone: false, ...(await aheadBehind(git, dir, localOid, upstreamOid)) };
}

function commits(n: number): string {
  return `${n} commit${n === 1 ? '' : 's'}`;
}

/** The "Your branch is ..." paragraph of `git status` and `git checkout`. */
export function trackingMessage(t: Tracking, hints = true): string {
  if (t.gone) {
    return `Your branch is based on '${t.upstream}', but the upstream is gone.\n` +
      (hints ? '  (use "git branch --unset-upstream" to fixup)\n' : '');
  }
  if (t.ahead === 0 && t.behind === 0) return `Your branch is up to date with '${t.upstream}'.\n`;
  if (t.behind === 0) {
    return `Your branch is ahead of '${t.upstream}' by ${commits(t.ahead)}.\n` +
      (hints ? '  (use "git push" to publish your local commits)\n' : '');
  }
  if (t.ahead === 0) {
    return `Your branch is behind '${t.upstream}' by ${commits(t.behind)}, and can be fast-forwarded.\n` +
      (hints ? '  (use "git pull" to update your local branch)\n' : '');
  }
  return `Your branch and '${t.upstream}' have diverged,\nand have ${t.ahead} and ${t.behind} different commits each, respectively.\n` +
    (hints ? '  (use "git pull" if you want to integrate the remote branch with yours)\n' : '');
}

/** Append a line to `.git/logs/HEAD`, which `git checkout -` reads. */
export async function appendHeadReflog(git: Git, fs: JSRuntimeFS, dir: string, from: string | undefined, to: string, message: string): Promise<void> {
  try {
    const name = (await git.getConfig({ dir, path: 'user.name' }) as string | undefined) ?? 'shakespeare.diy';
    const email = (await git.getConfig({ dir, path: 'user.email' }) as string | undefined) ?? 'assistant@shakespeare.diy';
    const seconds = Math.floor(Date.now() / 1000);
    const offset = -new Date().getTimezoneOffset();
    const tz = `${offset < 0 ? '-' : '+'}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}${String(Math.abs(offset) % 60).padStart(2, '0')}`;
    const line = `${from ?? '0'.repeat(40)} ${to} ${name} <${email}> ${seconds} ${tz}\t${message}\n`;
    await fs.mkdir(`${dir}/.git/logs`, { recursive: true });
    let existing = '';
    try {
      existing = await fs.readFile(`${dir}/.git/logs/HEAD`, 'utf8');
    } catch {
      // First entry.
    }
    await fs.writeFile(`${dir}/.git/logs/HEAD`, existing + line);
  } catch {
    // The reflog is a convenience; never fail a command over it.
  }
}

/** The branch (or commit) HEAD was on before the most recent checkout, for `git checkout -`. */
export async function previousCheckout(fs: JSRuntimeFS, dir: string): Promise<string | undefined> {
  let log: string;
  try {
    log = await fs.readFile(`${dir}/.git/logs/HEAD`, 'utf8');
  } catch {
    return undefined;
  }
  const lines = log.trimEnd().split('\n').reverse();
  for (const line of lines) {
    const match = line.match(/\tcheckout: moving from (\S+) to (\S+)$/);
    if (match) return match[1];
  }
  return undefined;
}

function sameVersion(a: FileVersion | undefined, b: FileVersion | undefined): boolean {
  return a?.oid === b?.oid && (!a || a.mode === b?.mode);
}

async function worktreeOid(git: Git, fs: JSRuntimeFS, dir: string, path: string): Promise<string | undefined> {
  try {
    const content = await fs.readFile(`${dir}/${path}`);
    return (await git.hashBlob({ object: content })).oid;
  } catch {
    return undefined;
  }
}

/**
 * Point a path's index entry at `version` (or delete it). Uses the working
 * tree file's stat data when its content already matches, as git does.
 */
export async function syncIndexEntry(git: Git, fs: JSRuntimeFS, dir: string, path: string, version: FileVersion | undefined): Promise<void> {
  if (version && version.mode === '100644' && (await worktreeOid(git, fs, dir, path)) === version.oid) {
    await git.add({ dir, filepath: path, force: true });
  } else {
    await setIndexEntry(git, dir, path, version);
  }
}

/** Make both the working tree and the index hold `version` at `path` (or delete it from both). */
export async function checkoutVersion(git: Git, fs: JSRuntimeFS, dir: string, path: string, version: FileVersion | undefined): Promise<void> {
  if (version) {
    await writeWorktreeFile(git, fs, dir, path, version.oid);
    if (version.mode === '100644') await git.add({ dir, filepath: path, force: true });
    else await setIndexEntry(git, dir, path, version);
  } else {
    await removeWorktreeFile(fs, dir, path);
    await git.remove({ dir, filepath: path });
  }
}

export interface SwitchOptions {
  /** Throw away local changes instead of carrying them over. */
  force: boolean;
  /** Wording for errors: `checkout` (default) or `reset`. */
  operation?: 'checkout' | 'reset';
}

/**
 * Move the index and working tree from tree `from` (the current HEAD) to
 * `to`. Like git's two-way merge, local changes to files the trees agree on
 * are carried over, and a change that would be lost aborts the whole switch
 * (returning git's error message). With `force`, local changes are discarded.
 */
export async function switchTrees(git: Git, fs: JSRuntimeFS, dir: string, from: Snapshot, to: Snapshot, options: SwitchOptions): Promise<string | undefined> {
  const index = await readIndexSnapshot(git, dir);
  const status = new Map((await readStatus(git, fs, dir)).map((s) => [s.path, s]));
  const isDirty = (path: string) => {
    const s = status.get(path);
    return !!s && s.inIndex && (s.staged !== ' ' || s.unstaged !== ' ');
  };

  if (options.force) {
    const paths = new Set([...index.keys(), ...to.keys()]);
    for (const path of [...paths].sort()) {
      const target = to.get(path);
      const s = status.get(path);
      if (target) {
        if (sameVersion(index.get(path), target) && s?.unstaged === ' ' && s.inWorktree) continue;
        await checkoutVersion(git, fs, dir, path, target);
      } else {
        await checkoutVersion(git, fs, dir, path, undefined);
      }
    }
    return undefined;
  }

  const changes = new Set<string>();
  for (const path of new Set([...from.keys(), ...to.keys()])) {
    if (!sameVersion(from.get(path), to.get(path))) changes.add(path);
  }

  const blocked: string[] = [];
  const untrackedBlocked: string[] = [];
  const toApply: string[] = [];
  for (const path of [...changes].sort()) {
    const target = to.get(path);
    const s = status.get(path);
    if (s?.untracked && !index.has(path)) {
      if (target && (await worktreeOid(git, fs, dir, path)) !== target.oid) untrackedBlocked.push(path);
      else if (target) toApply.push(path);
      continue;
    }
    if (isDirty(path) || (!s?.inIndex && from.has(path))) {
      if (sameVersion(index.get(path), target) && (s?.unstaged ?? ' ') === ' ') continue;
      blocked.push(path);
      continue;
    }
    toApply.push(path);
  }

  const operation = options.operation ?? 'checkout';
  if (untrackedBlocked.length > 0) {
    return `error: The following untracked working tree files would be overwritten by ${operation}:\n` +
      untrackedBlocked.map((p) => `\t${p}\n`).join('') +
      `Please move or remove them before you ${operation === 'checkout' ? 'switch branches' : 'reset'}.\nAborting`;
  }
  if (blocked.length > 0) {
    if (operation === 'reset') {
      return `error: Entry '${blocked[0]}' not uptodate. Cannot merge.`;
    }
    return 'error: Your local changes to the following files would be overwritten by checkout:\n' +
      blocked.map((p) => `\t${p}\n`).join('') +
      'Please commit your changes or stash them before you switch branches.\nAborting';
  }

  for (const path of toApply) {
    await checkoutVersion(git, fs, dir, path, to.get(path));
  }
  return undefined;
}

/** `M\tpath` lines for local changes against HEAD, as `git checkout` prints after switching. */
export async function localChanges(git: Git, fs: JSRuntimeFS, dir: string): Promise<string> {
  let out = '';
  for (const s of await readStatus(git, fs, dir)) {
    if (!s.inIndex && !s.inHead) continue;
    if (s.staged === ' ' && s.unstaged === ' ') continue;
    const letter = s.staged === 'D' || s.unstaged === 'D' ? 'D' : s.staged === 'A' ? 'A' : 'M';
    if (s.staged === 'A' && s.unstaged === 'D') continue;
    out += `${letter}\t${s.path}\n`;
  }
  return out;
}

/** The message for HEAD moving from one place to another, for the reflog. */
export function describeHead(branch: string | undefined, oid: string | undefined): string {
  return branch ?? (oid ? oid : 'HEAD');
}

export interface RestoreOptions {
  /** Where to restore from; the index when omitted. */
  source?: Snapshot;
  staged: boolean;
  worktree: boolean;
  /** Leave paths that are missing from the source alone (`git checkout`), instead of removing them (`git restore`). */
  overlay: boolean;
}

/**
 * Restore the paths matching `specs` in the index and/or working tree from
 * `source`. When a spec matches nothing, nothing is changed and the indexes
 * of the unmatched specs are returned; otherwise, how many paths changed.
 */
export async function restorePaths(git: Git, fs: JSRuntimeFS, dir: string, specs: string[], options: RestoreOptions): Promise<{ unmatched: number[]; count: number }> {
  const index = await readIndexSnapshot(git, dir);
  const source = options.source ?? index;
  const candidates = new Set(source.keys());
  if (!options.overlay) for (const path of index.keys()) candidates.add(path);

  const matched = new Set<number>();
  const paths: string[] = [];
  for (const path of [...candidates].sort()) {
    let hit = false;
    specs.forEach((spec, i) => {
      if (matchesAny(path, spec)) {
        matched.add(i);
        hit = true;
      }
    });
    if (hit) paths.push(path);
  }
  const unmatched = specs.map((_, i) => i).filter((i) => !matched.has(i));
  if (unmatched.length > 0) return { unmatched, count: 0 };

  let count = 0;
  for (const path of paths) {
    const version = source.get(path);
    let changed = false;
    if (options.worktree) {
      const current = await worktreeOid(git, fs, dir, path);
      if (version && current !== version.oid) {
        await writeWorktreeFile(git, fs, dir, path, version.oid);
        changed = true;
      } else if (!version && current !== undefined) {
        await removeWorktreeFile(fs, dir, path);
        changed = true;
      }
    }
    if (options.staged && !sameVersion(index.get(path), version)) {
      await syncIndexEntry(git, fs, dir, path, version);
      changed = true;
    }
    if (changed) count++;
  }
  return { unmatched, count };
}

/** Expand directory entries (`dir/`, as `listWorktree` reports ignored ones) into the files inside them. */
export async function expandDirectories(fs: JSRuntimeFS, dir: string, paths: string[]): Promise<string[]> {
  const files: string[] = [];
  const walk = async (rel: string): Promise<void> => {
    let entries;
    try {
      entries = await fs.readdir(`${dir}/${rel}`, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === '.git') continue;
      const path = `${rel}/${entry.name}`;
      if (entry.isDirectory()) await walk(path);
      else files.push(path);
    }
  };
  for (const path of paths) {
    if (path.endsWith('/')) await walk(path.slice(0, -1));
    else files.push(path);
  }
  return files.sort();
}

/**
 * How `git status` names a detached HEAD: `at <name>` when HEAD is still where
 * the last checkout put it, `from <name>` once commits have moved it.
 */
export async function detachedDescription(git: Git, fs: JSRuntimeFS, dir: string, head: string): Promise<string> {
  let log = '';
  try {
    log = await fs.readFile(`${dir}/.git/logs/HEAD`, 'utf8');
  } catch {
    // No reflog.
  }
  for (const line of log.trimEnd().split('\n').reverse()) {
    const match = line.match(/^\S+ (\S+) .*\tcheckout: moving from \S+ to (\S+)$/);
    if (!match) continue;
    const [, oid, target] = match;
    let name = abbrev(oid);
    if (!/^[0-9a-f]{4,40}$/i.test(target) && !/[~^:@]/.test(target)) {
      try {
        if ((await git.resolveRef({ dir, ref: target })) === oid || (await git.expandRef({ dir, ref: target }))) name = target;
      } catch {
        // Not a ref name.
      }
    }
    return `${oid === head ? 'at' : 'from'} ${name}`;
  }
  return `at ${abbrev(head)}`;
}
