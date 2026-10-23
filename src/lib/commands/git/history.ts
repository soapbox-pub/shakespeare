import type { ReadCommitResult } from 'isomorphic-git';
import type { Git } from '../../git';
import { lookupPath, resolveCommit } from './revisions';

export interface RevisionRange {
  include: string[];
  exclude: string[];
}

/**
 * Parse revision arguments (`A`, `A..B`, `A...B`, `^A`, `--not`) into
 * commits to start from and commits whose ancestors are excluded.
 * With no positive revision, HEAD is used.
 */
export async function parseRange(git: Git, dir: string, specs: string[], all = false): Promise<RevisionRange> {
  const include: string[] = [];
  const exclude: string[] = [];
  let negate = false;

  for (const spec of specs) {
    if (spec === '--not') {
      negate = !negate;
      continue;
    }
    const symmetric = spec.match(/^(.*?)\.\.\.(.*)$/);
    const range = symmetric ? null : spec.match(/^(.*?)\.\.(.*)$/);
    if (symmetric) {
      const a = await resolveCommit(git, dir, symmetric[1] || 'HEAD');
      const b = await resolveCommit(git, dir, symmetric[2] || 'HEAD');
      include.push(a, b);
      exclude.push(...await git.findMergeBase({ dir, oids: [a, b] }));
    } else if (range) {
      exclude.push(await resolveCommit(git, dir, range[1] || 'HEAD'));
      include.push(await resolveCommit(git, dir, range[2] || 'HEAD'));
    } else if (spec.startsWith('^')) {
      (negate ? include : exclude).push(await resolveCommit(git, dir, spec.slice(1)));
    } else {
      (negate ? exclude : include).push(await resolveCommit(git, dir, spec));
    }
  }

  if (all) {
    const refs = [
      ...(await git.listBranches({ dir })).map((b) => `refs/heads/${b}`),
      ...(await git.listTags({ dir })).map((t) => `refs/tags/${t}`),
    ];
    for (const remote of await git.listRemotes({ dir })) {
      for (const b of await git.listBranches({ dir, remote: remote.remote })) {
        if (b !== 'HEAD') refs.push(`refs/remotes/${remote.remote}/${b}`);
      }
    }
    for (const ref of refs) {
      try {
        include.push(await resolveCommit(git, dir, ref));
      } catch {
        // Not a commit (e.g. a tag of a tree).
      }
    }
    try {
      include.push(await git.resolveRef({ dir, ref: 'HEAD' }));
    } catch {
      // Unborn HEAD.
    }
  }

  if (include.length === 0 && !specs.some((s) => !s.startsWith('^') && s !== '--not')) {
    include.push(await resolveCommit(git, dir, 'HEAD'));
  }
  return { include, exclude };
}

export interface WalkOptions {
  firstParent?: boolean;
  /** Only commits that change these paths (compared with their first parent). */
  paths?: string[];
  /** Topological order (parents after all children) instead of date order. */
  topoOrder?: boolean;
}

/** Commits reachable from `include` but not from `exclude`, newest first, like `git rev-list`. */
export async function* walkCommits(git: Git, dir: string, range: RevisionRange, options: WalkOptions = {}): AsyncGenerator<ReadCommitResult> {
  const cache = new Map<string, ReadCommitResult>();
  const read = async (oid: string) => {
    let entry = cache.get(oid);
    if (!entry) {
      entry = await git.readCommit({ dir, oid });
      cache.set(oid, entry);
    }
    return entry;
  };

  // Mark everything reachable from the excluded commits.
  const excluded = new Set<string>();
  const stack = [...range.exclude];
  while (stack.length > 0) {
    const oid = stack.pop()!;
    if (excluded.has(oid)) continue;
    excluded.add(oid);
    try {
      stack.push(...(await read(oid)).commit.parent);
    } catch {
      // Missing object (shallow clone).
    }
  }

  const seen = new Set<string>();
  const queue: ReadCommitResult[] = [];
  const push = async (oid: string) => {
    if (seen.has(oid) || excluded.has(oid)) return;
    seen.add(oid);
    try {
      queue.push(await read(oid));
    } catch {
      // Missing object (shallow clone).
    }
  };
  for (const oid of range.include) await push(oid);

  while (queue.length > 0) {
    // Newest committer date first, like git's default ordering.
    queue.sort((a, b) => b.commit.committer.timestamp - a.commit.committer.timestamp);
    const entry = queue.shift()!;
    const parents = options.firstParent ? entry.commit.parent.slice(0, 1) : entry.commit.parent;
    for (const parent of parents) await push(parent);

    if (options.paths && options.paths.length > 0) {
      if (!(await touchesPaths(git, dir, entry, options.paths, read))) continue;
    }
    yield entry;
  }
}

async function touchesPaths(
  git: Git,
  dir: string,
  entry: ReadCommitResult,
  paths: string[],
  read: (oid: string) => Promise<ReadCommitResult>,
): Promise<boolean> {
  const versions = async (tree: string) => Promise.all(paths.map(async (p) => (await lookupPath(git, dir, tree, p))?.oid ?? null));
  const mine = await versions(entry.commit.tree);
  if (entry.commit.parent.length === 0) return mine.some((v) => v !== null);
  // A merge that matches any parent at these paths didn't change them.
  for (const parent of entry.commit.parent) {
    let theirs: (string | null)[];
    try {
      theirs = await versions((await read(parent)).commit.tree);
    } catch {
      return true;
    }
    if (theirs.every((v, i) => v === mine[i])) return false;
  }
  return true;
}
