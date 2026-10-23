import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { compareSnapshots, indexSnapshot, treeSnapshot, workdirSnapshot } from "./diffing";
import { abbrev, matchesPathspec, resolveCommit, RevisionError } from "./revisions";

interface Candidate {
  name: string;
  commit: string;
  annotated: boolean;
  /** Annotated tags (2) beat lightweight tags (1), which beat other refs (0). */
  priority: number;
  /** Tagger date for annotated tags, commit date otherwise. */
  date: number;
}

/** How many reachable tags to consider before picking the closest, like git's `--candidates`. */
const MAX_CANDIDATES = 10;

export class GitDescribeCommand implements GitSubcommand {
  name = 'describe';
  description = 'Give an object a human readable name based on an available ref';
  usage = 'git describe [--all] [--tags] [--always] [--long] [--abbrev=<n>] [--dirty[=<mark>]] [--exact-match] [--first-parent] [--match <pattern>] [--exclude <pattern>] [<commit-ish>...]';

  private git: Git;
  private fs: JSRuntimeFS;

  constructor(options: GitSubcommandOptions) {
    this.git = options.git;
    this.fs = options.fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    try {
      try {
        await this.fs.stat(`${cwd}/.git`);
      } catch {
        return createErrorResult('fatal: not a git repository (or any of the parent directories): .git', 128);
      }

      const parsed = parseArgs(args, {
        flags: {
          tags: 'tags', all: 'all', always: 'always', long: 'long', 'exact-match': 'exactMatch',
          'first-parent': 'firstParent', contains: 'contains',
        },
        values: { match: 'match', exclude: 'exclude', candidates: 'candidates' },
        optional: { abbrev: 'abbrev', dirty: 'dirty', broken: 'dirty' },
      });
      if (parsed.unknown.length > 0) return createErrorResult(unknownOption(parsed.unknown[0], this.usage), 129);
      if (parsed.has('contains')) return createErrorResult('fatal: --contains is not supported', 128);

      const revs = parsed.rest;
      if (parsed.has('dirty') && revs.length > 0) {
        return createErrorResult("fatal: option '--dirty' and commit-ishes cannot be used together", 128);
      }

      const abbrevValue = parsed.get('abbrev');
      const abbrevLength = abbrevValue === undefined ? 7 : Math.min(40, Math.max(0, parseInt(abbrevValue, 10) || 0));
      const abbrevOid = (oid: string) => abbrev(oid, abbrevLength === 0 ? 7 : Math.max(abbrevLength, 4));

      let suffix = '';
      if (parsed.has('dirty')) {
        const mark = parsed.get('dirty') ?? '-dirty';
        if (await this.isDirty(cwd)) suffix = mark;
      }

      const { candidates, unannotated, total } = await this.loadCandidates(cwd, parsed);
      const byCommit = new Map<string, Candidate>();
      for (const candidate of candidates) {
        const existing = byCommit.get(candidate.commit);
        if (!existing || better(candidate, existing)) byCommit.set(candidate.commit, candidate);
      }

      const lines: string[] = [];
      for (const rev of revs.length > 0 ? revs : ['HEAD']) {
        const oid = await resolveCommit(this.git, cwd, rev);

        const exact = byCommit.get(oid);
        if (exact) {
          lines.push(parsed.has('long') && abbrevLength > 0 ? `${exact.name}-0-g${abbrevOid(oid)}${suffix}` : `${exact.name}${suffix}`);
          continue;
        }

        if (parsed.has('exactMatch')) {
          return createErrorResult(`fatal: no tag exactly matches '${oid}'`, 128);
        }

        const best = byCommit.size > 0 ? await this.closest(cwd, oid, byCommit, parsed.has('firstParent')) : undefined;
        if (best) {
          lines.push(abbrevLength === 0 ? `${best.candidate.name}${suffix}` : `${best.candidate.name}-${best.depth}-g${abbrevOid(oid)}${suffix}`);
        } else if (parsed.has('always')) {
          lines.push(`${abbrevOid(oid)}${suffix}`);
        } else if (total === 0) {
          return createErrorResult('fatal: No names found, cannot describe anything.', 128);
        } else if (unannotated && !parsed.has('tags') && !parsed.has('all')) {
          return createErrorResult(`fatal: No annotated tags can describe '${oid}'.\nHowever, there were unannotated tags: try --tags.`, 128);
        } else {
          return createErrorResult(`fatal: No tags can describe '${oid}'.\nTry --always, or create some tags.`, 128);
        }
      }

      return createSuccessResult(`${lines.join('\n')}\n`);
    } catch (error) {
      if (error instanceof RevisionError) {
        const message = error.message.match(/^fatal: ambiguous argument '(.*)'/);
        return createErrorResult(message ? `fatal: Not a valid object name ${message[1]}` : error.message, 128);
      }
      return createErrorResult(`git describe: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async loadCandidates(dir: string, parsed: ReturnType<typeof parseArgs>): Promise<{ candidates: Candidate[]; unannotated: boolean; total: number }> {
    const useAll = parsed.has('all');
    const useLightweight = useAll || parsed.has('tags');
    const match = parsed.getAll('match');
    const exclude = parsed.getAll('exclude');
    const candidates: Candidate[] = [];
    let unannotated = false;
    let total = 0;

    for (const tag of await this.git.listTags({ dir })) {
      let oid: string;
      try {
        oid = await this.git.resolveRef({ dir, ref: `refs/tags/${tag}` });
      } catch {
        continue;
      }
      if (match.length > 0 && !match.some((m) => matchesPathspec(tag, [m]))) continue;
      if (exclude.some((m) => matchesPathspec(tag, [m]))) continue;
      total++;

      const obj = await this.git.readObject({ dir, oid, format: 'parsed' });
      const annotated = obj.type === 'tag';
      if (!annotated) unannotated = true;
      if (!annotated && !useLightweight) continue;

      let commit: string;
      try {
        commit = await resolveCommit(this.git, dir, oid);
      } catch {
        continue;
      }
      const date = annotated
        ? (obj.object as { tagger?: { timestamp: number } }).tagger?.timestamp ?? 0
        : (await this.git.readCommit({ dir, oid: commit })).commit.committer.timestamp;
      candidates.push({ name: useAll ? `tags/${tag}` : tag, commit, annotated, priority: annotated ? 2 : 1, date });
    }

    if (useAll) {
      const refs: Array<[string, string]> = [];
      for (const branch of await this.git.listBranches({ dir })) refs.push([`heads/${branch}`, `refs/heads/${branch}`]);
      for (const remote of await this.git.listRemotes({ dir })) {
        for (const branch of await this.git.listBranches({ dir, remote: remote.remote })) {
          if (branch !== 'HEAD') refs.push([`remotes/${remote.remote}/${branch}`, `refs/remotes/${remote.remote}/${branch}`]);
        }
      }
      for (const [name, ref] of refs) {
        try {
          const commit = await this.git.resolveRef({ dir, ref });
          const { commit: info } = await this.git.readCommit({ dir, oid: commit });
          candidates.push({ name, commit, annotated: false, priority: 0, date: info.committer.timestamp });
          total++;
        } catch {
          // Dangling ref.
        }
      }
    }

    return { candidates, unannotated, total };
  }

  /** The candidate with the fewest commits between it and `oid`. */
  private async closest(dir: string, oid: string, byCommit: Map<string, Candidate>, firstParent: boolean): Promise<{ candidate: Candidate; depth: number } | undefined> {
    const parents = new Map<string, string[]>();
    const parentsOf = async (commit: string): Promise<string[]> => {
      let list = parents.get(commit);
      if (!list) {
        const { commit: info } = await this.git.readCommit({ dir, oid: commit });
        list = firstParent ? info.parent.slice(0, 1) : info.parent;
        parents.set(commit, list);
      }
      return list;
    };

    // Every ancestor of `oid`, and the tagged ones in the order a breadth-first walk meets them.
    const ancestors = new Set<string>([oid]);
    const found: Candidate[] = [];
    const queue = [oid];
    while (queue.length > 0) {
      const commit = queue.shift()!;
      const candidate = byCommit.get(commit);
      if (candidate && found.length < MAX_CANDIDATES) found.push(candidate);
      for (const parent of await parentsOf(commit)) {
        if (!ancestors.has(parent)) {
          ancestors.add(parent);
          queue.push(parent);
        }
      }
    }

    let best: { candidate: Candidate; depth: number } | undefined;
    for (const candidate of found) {
      const reachable = new Set<string>([candidate.commit]);
      const stack = [candidate.commit];
      while (stack.length > 0) {
        for (const parent of await parentsOf(stack.pop()!)) {
          if (!reachable.has(parent)) {
            reachable.add(parent);
            stack.push(parent);
          }
        }
      }
      const depth = ancestors.size - reachable.size;
      if (!best || depth < best.depth) best = { candidate, depth };
    }
    return best;
  }

  private async isDirty(dir: string): Promise<boolean> {
    let headTree: string | null = null;
    try {
      const head = await this.git.resolveRef({ dir, ref: 'HEAD' });
      headTree = (await this.git.readCommit({ dir, oid: head })).commit.tree;
    } catch {
      // No commits yet.
    }
    const head = await treeSnapshot(this.git, dir, headTree);
    const index = await indexSnapshot(this.git, dir);
    if (compareSnapshots(head, index).length > 0) return true;
    const workdir = await workdirSnapshot(this.git, this.fs, dir, index);
    return compareSnapshots(index, workdir).length > 0;
  }
}

/** Annotated tags beat lightweight ones, which beat branches; then the newer one wins. */
function better(a: Candidate, b: Candidate): boolean {
  if (a.priority !== b.priority) return a.priority > b.priority;
  return a.date > b.date;
}
