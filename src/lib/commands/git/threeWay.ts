import { diff3Merge } from 'node-diff3';
import type { JSRuntimeFS } from '../../JSRuntime';
import type { Git } from '../../git';
import { compareSnapshots, indexSnapshot, isBinary, readVersion, workdirSnapshot, type FileVersion, type Snapshot } from './diffing';

export interface ThreeWayInput {
  /** The tree the change is relative to. */
  base: Snapshot;
  /** The tree with the change applied. */
  theirs: Snapshot;
  /** The current commit's tree. */
  ours: Snapshot;
  /** Conflict marker labels. */
  ourLabel: string;
  theirLabel: string;
}

export interface ThreeWayResult {
  /** Paths merged cleanly and staged. */
  updated: string[];
  /** Conflict messages, git-style (`CONFLICT (content): Merge conflict in x`). */
  conflicts: string[];
  /** Paths with conflicts, left unstaged in the working tree. */
  conflicted: string[];
}

/** Paths whose index or working-tree version differs from `ours`. */
export async function dirtyPaths(git: Git, fs: JSRuntimeFS, dir: string, ours: Snapshot): Promise<Set<string>> {
  const index = await indexSnapshot(git, dir);
  const workdir = await workdirSnapshot(git, fs, dir, index);
  const dirty = new Set<string>();
  for (const change of compareSnapshots(ours, index)) dirty.add(change.path);
  for (const change of compareSnapshots(index, workdir)) dirty.add(change.path);
  return dirty;
}

/**
 * Apply the change from `base` to `theirs` on top of `ours`, writing the
 * working tree and index. Files changed on both sides are merged line by
 * line; conflicts are written with markers and left unstaged.
 *
 * Throws if a file to be touched has uncommitted changes.
 */
export async function applyThreeWay(git: Git, fs: JSRuntimeFS, dir: string, input: ThreeWayInput, operation: string): Promise<ThreeWayResult> {
  const { base, theirs, ours } = input;
  const changes = compareSnapshots(base, theirs);

  const dirty = await dirtyPaths(git, fs, dir, ours);
  const blocked = changes.map((c) => c.path).filter((p) => dirty.has(p));
  if (blocked.length > 0) {
    throw new Error(
      `error: Your local changes to the following files would be overwritten by ${operation}:\n` +
      blocked.map((p) => `\t${p}\n`).join('') +
      'Please commit your changes or stash them before you proceed.\n' +
      `fatal: ${operation} failed`,
    );
  }

  const result: ThreeWayResult = { updated: [], conflicts: [], conflicted: [] };

  for (const { path } of changes) {
    const b = base.get(path);
    const t = theirs.get(path);
    const o = ours.get(path);

    if (sameVersion(o, b)) {
      await writeVersion(git, fs, dir, path, t);
      result.updated.push(path);
    } else if (sameVersion(o, t)) {
      // Already applied.
    } else if (!o) {
      result.conflicts.push(`CONFLICT (modify/delete): ${path} deleted in ${input.ourLabel} and modified in ${input.theirLabel}.`);
      await writeVersion(git, fs, dir, path, t, false);
      result.conflicted.push(path);
    } else if (!t) {
      result.conflicts.push(`CONFLICT (modify/delete): ${path} deleted in ${input.theirLabel} and modified in ${input.ourLabel}.`);
      result.conflicted.push(path);
    } else {
      const merged = await mergeText(
        await readVersion(git, dir, b),
        await readVersion(git, dir, o),
        await readVersion(git, dir, t),
        input.ourLabel,
        input.theirLabel,
      );
      if (merged === null) {
        result.conflicts.push(`warning: Cannot merge binary files: ${path} (${input.ourLabel} vs. ${input.theirLabel})`);
        result.conflicts.push(`CONFLICT (content): Merge conflict in ${path}`);
        result.conflicted.push(path);
      } else {
        await writeFile(fs, dir, path, merged.content);
        if (merged.clean) {
          await git.add({ dir, filepath: path });
          result.updated.push(path);
        } else {
          result.conflicts.push(`${b ? 'CONFLICT (content)' : 'CONFLICT (add/add)'}: Merge conflict in ${path}`);
          result.conflicted.push(path);
        }
      }
    }
  }

  return result;
}

function sameVersion(a: FileVersion | undefined, b: FileVersion | undefined): boolean {
  return a?.oid === b?.oid;
}

async function writeFile(fs: JSRuntimeFS, dir: string, path: string, content: Uint8Array | string): Promise<void> {
  const slash = path.lastIndexOf('/');
  if (slash !== -1) await fs.mkdir(`${dir}/${path.slice(0, slash)}`, { recursive: true });
  await fs.writeFile(`${dir}/${path}`, content);
}

/** Make the working tree (and, when `stage`, the index) hold `version`, or delete the file. */
export async function writeVersion(git: Git, fs: JSRuntimeFS, dir: string, path: string, version: FileVersion | undefined, stage = true): Promise<void> {
  if (version) {
    await writeFile(fs, dir, path, await readVersion(git, dir, version));
    if (stage) await git.add({ dir, filepath: path });
  } else {
    try {
      await fs.unlink(`${dir}/${path}`);
    } catch {
      // Already gone.
    }
    if (stage) await git.remove({ dir, filepath: path });
  }
}

/** Line-based three-way merge. Returns null for binary files. */
export async function mergeText(
  base: Uint8Array,
  ours: Uint8Array,
  theirs: Uint8Array,
  ourLabel: string,
  theirLabel: string,
): Promise<{ clean: boolean; content: string } | null> {
  if (isBinary(base) || isBinary(ours) || isBinary(theirs)) return null;
  const decoder = new TextDecoder();
  const split = (bytes: Uint8Array) => decoder.decode(bytes).match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const regions = diff3Merge(split(ours), split(base), split(theirs), { excludeFalseConflicts: true });

  let content = '';
  let clean = true;
  const ensureNewline = () => {
    if (content && !content.endsWith('\n')) content += '\n';
  };
  for (const region of regions) {
    if (region.ok) {
      content += region.ok.join('');
    } else if (region.conflict) {
      clean = false;
      ensureNewline();
      content += `<<<<<<< ${ourLabel}\n${region.conflict.a.join('')}`;
      ensureNewline();
      content += `=======\n${region.conflict.b.join('')}`;
      ensureNewline();
      content += `>>>>>>> ${theirLabel}\n`;
    }
  }
  return { clean, content };
}
