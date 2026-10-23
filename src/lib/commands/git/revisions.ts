import { STAGE } from 'isomorphic-git';
import type { Git } from '../../git';

export type ObjectType = 'commit' | 'tree' | 'blob' | 'tag';

export interface TreeEntryInfo {
  path: string;
  oid: string;
  mode: string;
  type: ObjectType;
}

/** A revision that could not be resolved. Its message is git's own wording. */
export class RevisionError extends Error {}

/** Full or abbreviated object id. */
const HEX = /^[0-9a-f]{4,40}$/i;

/**
 * Resolve a git revision to an object id, the way `git rev-parse` does.
 *
 * Supports full and abbreviated object ids, `HEAD`, `@`, branch, tag and
 * remote-tracking names, `refs/...` paths, the `~N`, `^N`, `^{type}` and
 * `^{}` suffixes (chained), `<rev>:<path>` for a tree or blob in a commit,
 * and `:<path>` (or `:0:<path>`) for a blob in the index.
 */
export async function resolveRevision(git: Git, dir: string, spec: string): Promise<string> {
  const indexMatch = spec.match(/^:(?:0:)?(.+)$/);
  if (indexMatch) {
    const entry = (await readIndex(git, dir)).get(normalizePath(indexMatch[1]));
    if (!entry) throw new RevisionError(`fatal: path '${indexMatch[1]}' does not exist (neither on disk nor in the index)`);
    return entry.oid;
  }

  const colon = findPathColon(spec);
  if (colon !== -1) {
    const rev = spec.slice(0, colon);
    const path = normalizePath(spec.slice(colon + 1));
    const treeOid = await peel(git, dir, await resolveRevision(git, dir, rev), 'tree', spec);
    if (!path) return treeOid;
    const entry = await lookupPath(git, dir, treeOid, path);
    if (!entry) throw new RevisionError(`fatal: path '${path}' does not exist in '${rev}'`);
    return entry.oid;
  }

  // Split into a base name and a chain of suffix operators.
  const match = spec.match(/^(.*?)((?:~\d*|\^\d*|\^\{[a-z]*\})*)$/);
  const base = match?.[1] ?? spec;
  const suffixes = match?.[2] ?? '';
  if (!base) throw new RevisionError(unknownRevision(spec));

  let oid = await resolveName(git, dir, base, spec);
  for (const [op] of suffixes.matchAll(/~\d*|\^\{[a-z]*\}|\^\d*/g)) {
    if (op.startsWith('^{')) {
      const type = op.slice(2, -1);
      if (type === '') {
        oid = await peelTags(git, dir, oid);
      } else if (type === 'commit' || type === 'tree' || type === 'blob' || type === 'tag') {
        oid = await peel(git, dir, oid, type, spec);
      } else {
        throw new RevisionError(unknownRevision(spec));
      }
    } else if (op.startsWith('~')) {
      const steps = op.length > 1 ? parseInt(op.slice(1), 10) : 1;
      for (let i = 0; i < steps; i++) {
        oid = await nthParent(git, dir, oid, 1, spec);
      }
    } else {
      const n = op.length > 1 ? parseInt(op.slice(1), 10) : 1;
      oid = n === 0 ? await peel(git, dir, oid, 'commit', spec) : await nthParent(git, dir, oid, n, spec);
    }
  }
  return oid;
}

/** Resolve a revision and peel it to a commit. */
export async function resolveCommit(git: Git, dir: string, spec: string): Promise<string> {
  return peel(git, dir, await resolveRevision(git, dir, spec), 'commit', spec);
}

/** Resolve a revision and peel it to a tree. */
export async function resolveTree(git: Git, dir: string, spec: string): Promise<string> {
  return peel(git, dir, await resolveRevision(git, dir, spec), 'tree', spec);
}

/** Whether `spec` names something `resolveRevision` can resolve. */
export async function isRevision(git: Git, dir: string, spec: string): Promise<boolean> {
  try {
    await resolveRevision(git, dir, spec);
    return true;
  } catch {
    return false;
  }
}

/** Short form of an object id. */
export function abbrev(oid: string, length = 7): string {
  return oid.slice(0, length);
}

export function unknownRevision(spec: string): string {
  return `fatal: ambiguous argument '${spec}': unknown revision or path not in the working tree.`;
}

/**
 * The colon separating `<rev>:<path>`, skipping colons inside `^{...}` and
 * ignoring a leading colon (an index path).
 */
function findPathColon(spec: string): number {
  let depth = 0;
  for (let i = 1; i < spec.length; i++) {
    const c = spec[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === ':' && depth === 0) return i;
  }
  return -1;
}

function normalizePath(path: string): string {
  return path.replace(/^\.\//, '').replace(/\/+$/, '').replace(/^\/+/, '');
}

/**
 * The full ref name of a branch's upstream (`refs/remotes/origin/main`), from
 * `branch.<name>.remote` and `branch.<name>.merge`. Defaults to the current branch.
 */
export async function upstreamRef(git: Git, dir: string, branch?: string): Promise<string | undefined> {
  const name = branch || (await git.currentBranch({ dir })) || undefined;
  if (!name) return undefined;
  const remote = await git.getConfig({ dir, path: `branch.${name}.remote` });
  const merge = await git.getConfig({ dir, path: `branch.${name}.merge` });
  if (!remote || !merge) return undefined;
  const short = String(merge).replace(/^refs\/heads\//, '');
  return remote === '.' ? `refs/heads/${short}` : `refs/remotes/${remote}/${short}`;
}

async function resolveName(git: Git, dir: string, name: string, spec: string): Promise<string> {
  const upstream = name.match(/^(.*)@\{(?:u|upstream|push)\}$/i);
  if (upstream) {
    const ref = await upstreamRef(git, dir, upstream[1] === '@' ? undefined : upstream[1]);
    if (!ref) throw new RevisionError(`fatal: no upstream configured for branch '${upstream[1] || (await git.currentBranch({ dir })) || 'HEAD'}'`);
    return git.resolveRef({ dir, ref });
  }

  const ref = name === '@' ? 'HEAD' : name;
  try {
    return await git.resolveRef({ dir, ref });
  } catch {
    // Not a ref; try an object id.
  }
  try {
    // A bare remote name means its default branch.
    return await git.resolveRef({ dir, ref: `refs/remotes/${ref}/HEAD` });
  } catch {
    // Not a remote either.
  }
  if (HEX.test(ref)) {
    try {
      return await git.expandOid({ dir, oid: ref.toLowerCase() });
    } catch (error) {
      if (error instanceof Error && /ambiguous/i.test(error.message)) {
        throw new RevisionError(`error: short object ID ${ref} is ambiguous\n${unknownRevision(spec)}`);
      }
    }
  }
  throw new RevisionError(unknownRevision(spec));
}

export async function objectType(git: Git, dir: string, oid: string): Promise<ObjectType> {
  const { type } = await git.readObject({ dir, oid, format: 'parsed' });
  return type as ObjectType;
}

async function peelTags(git: Git, dir: string, oid: string): Promise<string> {
  let current = oid;
  for (let i = 0; i < 16; i++) {
    const obj = await git.readObject({ dir, oid: current, format: 'parsed' });
    if (obj.type !== 'tag') return current;
    current = (obj.object as { object: string }).object;
  }
  return current;
}

/** Peel tags (and commits, for `tree`) until an object of `type` is reached. */
export async function peel(git: Git, dir: string, oid: string, type: ObjectType, spec: string): Promise<string> {
  let current = oid;
  for (let i = 0; i < 16; i++) {
    let obj;
    try {
      obj = await git.readObject({ dir, oid: current, format: 'parsed' });
    } catch {
      throw new RevisionError(unknownRevision(spec));
    }
    if (obj.type === type) return current;
    if (obj.type === 'tag') {
      current = (obj.object as { object: string }).object;
    } else if (obj.type === 'commit' && type === 'tree') {
      current = (obj.object as { tree: string }).tree;
    } else {
      break;
    }
  }
  throw new RevisionError(`error: ${spec} does not name a ${type}\nfatal: Not a valid object name ${spec}`);
}

async function nthParent(git: Git, dir: string, oid: string, n: number, spec: string): Promise<string> {
  const commitOid = await peel(git, dir, oid, 'commit', spec);
  const { commit } = await git.readCommit({ dir, oid: commitOid });
  const parent = commit.parent[n - 1];
  if (!parent) throw new RevisionError(unknownRevision(spec));
  return parent;
}

/** Find a path inside a tree. */
export async function lookupPath(git: Git, dir: string, treeOid: string, path: string): Promise<TreeEntryInfo | null> {
  const parts = normalizePath(path).split('/').filter(Boolean);
  let oid = treeOid;
  let entry: TreeEntryInfo | null = null;
  for (let i = 0; i < parts.length; i++) {
    if (entry && entry.type !== 'tree') return null;
    const { tree } = await git.readTree({ dir, oid });
    const found = tree.find((e) => e.path === parts[i]);
    if (!found) return null;
    entry = { path: parts.slice(0, i + 1).join('/'), oid: found.oid, mode: found.mode, type: found.type as ObjectType };
    oid = found.oid;
  }
  return entry;
}

/** Every blob (and submodule) in a tree, keyed by path. */
export async function listTree(git: Git, dir: string, treeOid: string): Promise<Map<string, TreeEntryInfo>> {
  const files = new Map<string, TreeEntryInfo>();
  const walk = async (oid: string, prefix: string): Promise<void> => {
    const { tree } = await git.readTree({ dir, oid });
    for (const entry of tree) {
      const path = prefix ? `${prefix}/${entry.path}` : entry.path;
      if (entry.type === 'tree') {
        await walk(entry.oid, path);
      } else {
        files.set(path, { path, oid: entry.oid, mode: entry.mode, type: entry.type as ObjectType });
      }
    }
  };
  await walk(treeOid, '');
  return files;
}

/** Every file in a commit, keyed by path. */
export async function listCommitFiles(git: Git, dir: string, commitOid: string): Promise<Map<string, TreeEntryInfo>> {
  const { commit } = await git.readCommit({ dir, oid: commitOid });
  return listTree(git, dir, commit.tree);
}

/** The index (staging area), keyed by path. */
export async function readIndex(git: Git, dir: string): Promise<Map<string, TreeEntryInfo>> {
  const entries = new Map<string, TreeEntryInfo>();
  await git.walk({
    dir,
    trees: [STAGE()],
    map: async (filepath, [entry]) => {
      if (!entry || filepath === '.') return undefined;
      const type = await entry.type();
      if (type === 'tree') return true;
      const oid = await entry.oid();
      const mode = (await entry.mode()).toString(8).padStart(6, '0');
      entries.set(filepath, { path: filepath, oid, mode, type: 'blob' });
      return undefined;
    },
  });
  return entries;
}

/** Read a blob's bytes. */
export async function readBlobBytes(git: Git, dir: string, oid: string): Promise<Uint8Array> {
  const { blob } = await git.readBlob({ dir, oid });
  return blob;
}

/** Whether a pathspec list matches a path (directory prefixes and simple globs). */
export function matchesPathspec(path: string, pathspecs: string[]): boolean {
  if (pathspecs.length === 0) return true;
  return pathspecs.some((spec) => {
    const p = normalizePath(spec);
    if (p === '' || p === '.') return true;
    if (/[*?[]/.test(p)) return globToRegExp(p).test(path);
    return path === p || path.startsWith(`${p}/`);
  });
}

function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i++;
        if (glob[i + 1] === '/') i++;
      } else {
        re += '.*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if (c === '[') {
      const end = glob.indexOf(']', i);
      if (end === -1) {
        re += '\\[';
      } else {
        re += glob.slice(i, end + 1);
        i = end;
      }
    } else {
      re += c.replace(/[.+^${}()|\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}(/.*)?$`);
}
