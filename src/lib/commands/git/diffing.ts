import { structuredPatch } from 'diff';
import type { JSRuntimeFS } from '../../JSRuntime';
import type { Git } from '../../git';
import { abbrev, listTree, matchesPathspec, readIndex, type TreeEntryInfo } from './revisions';

/** One side of a comparison: a file's object id and mode, and its bytes when already known. */
export interface FileVersion {
  oid: string;
  mode: string;
  content?: Uint8Array;
}

/** The files of a tree, the index, or the working tree, keyed by path. */
export type Snapshot = Map<string, FileVersion>;

export interface FileChange {
  path: string;
  status: 'A' | 'M' | 'D';
  old?: FileVersion;
  new?: FileVersion;
}

export interface DiffFormat {
  patch: boolean;
  stat: boolean;
  shortstat: boolean;
  numstat: boolean;
  nameOnly: boolean;
  nameStatus: boolean;
  context: number;
}

export const ZERO_OID = '0000000000000000000000000000000000000000';

const decoder = new TextDecoder();

export async function treeSnapshot(git: Git, dir: string, treeOid: string | null): Promise<Snapshot> {
  if (!treeOid) return new Map();
  return toSnapshot(await listTree(git, dir, treeOid));
}

export async function indexSnapshot(git: Git, dir: string): Promise<Snapshot> {
  return toSnapshot(await readIndex(git, dir));
}

/** The working-tree versions of the files in `tracked` (deleted files are left out). */
export async function workdirSnapshot(git: Git, fs: JSRuntimeFS, dir: string, tracked: Snapshot): Promise<Snapshot> {
  const snapshot: Snapshot = new Map();
  for (const [path, version] of tracked) {
    let content: Uint8Array;
    try {
      content = await fs.readFile(`${dir}/${path}`);
    } catch {
      continue;
    }
    const { oid } = await git.hashBlob({ object: content });
    snapshot.set(path, { oid, mode: version.mode, content });
  }
  return snapshot;
}

function toSnapshot(entries: Map<string, TreeEntryInfo>): Snapshot {
  const snapshot: Snapshot = new Map();
  for (const [path, entry] of entries) {
    snapshot.set(path, { oid: entry.oid, mode: entry.mode });
  }
  return snapshot;
}

/** The files that differ between two snapshots, sorted by path. */
export function compareSnapshots(from: Snapshot, to: Snapshot, pathspecs: string[] = []): FileChange[] {
  const changes: FileChange[] = [];
  const paths = new Set([...from.keys(), ...to.keys()]);
  for (const path of [...paths].sort(comparePaths)) {
    if (!matchesPathspec(path, pathspecs)) continue;
    const a = from.get(path);
    const b = to.get(path);
    if (a && b) {
      if (a.oid !== b.oid || a.mode !== b.mode) changes.push({ path, status: 'M', old: a, new: b });
    } else if (a) {
      changes.push({ path, status: 'D', old: a });
    } else if (b) {
      changes.push({ path, status: 'A', new: b });
    }
  }
  return changes;
}

/** git orders paths bytewise. */
function comparePaths(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export async function readVersion(git: Git, dir: string, version: FileVersion | undefined): Promise<Uint8Array> {
  if (!version) return new Uint8Array();
  if (version.content) return version.content;
  const { blob } = await git.readBlob({ dir, oid: version.oid });
  return blob;
}

export function isBinary(bytes: Uint8Array): boolean {
  const end = Math.min(bytes.length, 8000);
  for (let i = 0; i < end; i++) {
    if (bytes[i] === 0) return true;
  }
  return false;
}

interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

function hunks(oldText: string, newText: string, context: number): Hunk[] {
  return structuredPatch('a', 'b', oldText, newText, '', '', { context }).hunks;
}

function hunkRange(start: number, count: number): string {
  // git points at the line before an empty range, and omits a count of 1.
  if (count === 0) return `${start - 1},0`;
  return count === 1 ? `${start}` : `${start},${count}`;
}

/** Lines added and removed, or null for binary files. */
export function countLines(oldBytes: Uint8Array, newBytes: Uint8Array): { added: number; removed: number } | null {
  if (isBinary(oldBytes) || isBinary(newBytes)) return null;
  let added = 0;
  let removed = 0;
  for (const hunk of hunks(decoder.decode(oldBytes), decoder.decode(newBytes), 0)) {
    for (const line of hunk.lines) {
      if (line[0] === '+') added++;
      else if (line[0] === '-') removed++;
    }
  }
  return { added, removed };
}

/** A `diff --git` patch for one file. */
export function formatPatch(change: FileChange, oldBytes: Uint8Array, newBytes: Uint8Array, context = 3): string {
  const { path } = change;
  const oldOid = abbrev(change.old?.oid ?? ZERO_OID);
  const newOid = abbrev(change.new?.oid ?? ZERO_OID);
  const lines = [`diff --git a/${path} b/${path}`];

  if (change.status === 'A') {
    lines.push(`new file mode ${change.new!.mode}`, `index ${oldOid}..${newOid}`);
  } else if (change.status === 'D') {
    lines.push(`deleted file mode ${change.old!.mode}`, `index ${oldOid}..${newOid}`);
  } else if (change.old!.mode !== change.new!.mode) {
    lines.push(`old mode ${change.old!.mode}`, `new mode ${change.new!.mode}`);
    if (change.old!.oid !== change.new!.oid) lines.push(`index ${oldOid}..${newOid}`);
  } else {
    lines.push(`index ${oldOid}..${newOid} ${change.new!.mode}`);
  }

  if (change.old?.oid === change.new?.oid) return lines.join('\n') + '\n';

  const a = change.status === 'A' ? '/dev/null' : `a/${path}`;
  const b = change.status === 'D' ? '/dev/null' : `b/${path}`;

  if (isBinary(oldBytes) || isBinary(newBytes)) {
    lines.push(`Binary files ${a} and ${b} differ`);
    return lines.join('\n') + '\n';
  }

  const fileHunks = hunks(decoder.decode(oldBytes), decoder.decode(newBytes), context);
  if (fileHunks.length > 0) {
    lines.push(`--- ${a}`, `+++ ${b}`);
    for (const hunk of fileHunks) {
      lines.push(`@@ -${hunkRange(hunk.oldStart, hunk.oldLines)} +${hunkRange(hunk.newStart, hunk.newLines)} @@`);
      lines.push(...hunk.lines);
    }
  }
  return lines.join('\n') + '\n';
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function formatSummary(files: number, added: number, removed: number): string {
  const parts = [`${files} file${files === 1 ? '' : 's'} changed`];
  const neither = added === 0 && removed === 0;
  if (added > 0 || neither) parts.push(`${plural(added, 'insertion')}(+)`);
  if (removed > 0 || neither) parts.push(`${plural(removed, 'deletion')}(-)`);
  return ` ${parts.join(', ')}`;
}

/** Render a list of changes in the requested formats, like `git diff`. */
export async function formatChanges(git: Git, dir: string, changes: FileChange[], format: DiffFormat): Promise<string> {
  if (changes.length === 0) return '';

  if (format.nameOnly) return changes.map((c) => `${c.path}\n`).join('');
  if (format.nameStatus) return changes.map((c) => `${c.status}\t${c.path}\n`).join('');

  const contents = await Promise.all(changes.map(async (c) => ({
    change: c,
    old: await readVersion(git, dir, c.old),
    new: await readVersion(git, dir, c.new),
  })));

  let out = '';

  if (format.numstat) {
    for (const { change, old, new: next } of contents) {
      const counts = countLines(old, next);
      out += counts ? `${counts.added}\t${counts.removed}\t${change.path}\n` : `-\t-\t${change.path}\n`;
    }
  }

  if (format.stat || format.shortstat) {
    const rows = contents.map(({ change, old, new: next }) => ({ path: change.path, counts: countLines(old, next), old, next }));
    const added = rows.reduce((n, r) => n + (r.counts?.added ?? 0), 0);
    const removed = rows.reduce((n, r) => n + (r.counts?.removed ?? 0), 0);
    if (format.stat) {
      const width = Math.max(...rows.map((r) => r.path.length));
      const maxChange = Math.max(...rows.map((r) => (r.counts ? r.counts.added + r.counts.removed : 0)));
      const countWidth = String(maxChange).length;
      const barSpace = Math.max(10, 80 - width - countWidth - 6);
      for (const { path, counts, old, next } of rows) {
        if (!counts) {
          out += ` ${path.padEnd(width)} | Bin ${old.length} -> ${next.length} bytes\n`;
          continue;
        }
        const total = counts.added + counts.removed;
        let plus = counts.added;
        let minus = counts.removed;
        if (maxChange > barSpace) {
          plus = Math.ceil((plus * barSpace) / maxChange);
          minus = Math.ceil((minus * barSpace) / maxChange);
        }
        out += ` ${path.padEnd(width)} | ${String(total).padStart(countWidth)}${total > 0 ? ' ' : ''}${'+'.repeat(plus)}${'-'.repeat(minus)}\n`;
      }
    }
    out += formatSummary(rows.length, added, removed) + '\n';
  }

  if (format.patch) {
    if (out) out += '\n';
    for (const { change, old, new: next } of contents) {
      out += formatPatch(change, old, next, format.context);
    }
  }

  return out;
}

export function defaultDiffFormat(): DiffFormat {
  return { patch: true, stat: false, shortstat: false, numstat: false, nameOnly: false, nameStatus: false, context: 3 };
}
