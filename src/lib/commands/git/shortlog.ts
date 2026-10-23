import type { ReadCommitResult } from "isomorphic-git";
import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { listTree, lookupPath, matchesPathspec, resolveCommit, RevisionError } from "./revisions";

interface Group {
  name: string;
  subjects: Array<{ subject: string; time: number; order: number }>;
}

export class GitShortlogCommand implements GitSubcommand {
  name = 'shortlog';
  description = 'Summarize git log output';
  usage = 'git shortlog [-s] [-n] [-e] [-c] [--no-merges] [--all] [<revision-range>] [[--] <path>...]';

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
          s: 'summary', summary: 'summary', n: 'numbered', numbered: 'numbered', e: 'email', email: 'email',
          c: 'committer', committer: 'committer', 'no-merges': 'noMerges', merges: 'merges', all: 'all',
          'first-parent': 'firstParent',
        },
        values: { group: 'group' },
      });
      if (parsed.unknown.length > 0) return createErrorResult(unknownOption(parsed.unknown[0], this.usage), 129);

      let committer = parsed.has('committer');
      const group = parsed.get('group');
      if (group === 'committer') committer = true;
      else if (group !== undefined && group !== 'author') return createErrorResult(`fatal: unknown group type: ${group}`, 128);

      // Positionals are revisions; with no revision (and no stdin here), summarize HEAD.
      const include: string[] = [];
      const exclude: string[] = [];
      for (const spec of parsed.positionals) {
        const range = spec.match(/^(.*?)\.\.(\.?)(.*)$/);
        if (range && range[2] !== '.') {
          exclude.push(await resolveCommit(this.git, cwd, range[1] || 'HEAD'));
          include.push(await resolveCommit(this.git, cwd, range[3] || 'HEAD'));
        } else if (spec.startsWith('^')) {
          exclude.push(await resolveCommit(this.git, cwd, spec.slice(1)));
        } else {
          include.push(await resolveCommit(this.git, cwd, spec));
        }
      }
      if (parsed.has('all')) {
        for (const branch of await this.git.listBranches({ dir: cwd })) {
          include.push(await this.git.resolveRef({ dir: cwd, ref: `refs/heads/${branch}` }));
        }
      }
      if (include.length === 0) {
        try {
          include.push(await this.git.resolveRef({ dir: cwd, ref: 'HEAD' }));
        } catch {
          return createSuccessResult('');
        }
      }

      const firstParent = parsed.has('firstParent');
      const excluded = await this.reachable(cwd, exclude, new Set(), firstParent);
      const commits = [...(await this.reachable(cwd, include, excluded, firstParent)).values()];

      const groups = new Map<string, Group>();
      let order = 0;
      for (const entry of commits) {
        const { commit } = entry;
        if (parsed.has('noMerges') && commit.parent.length > 1) continue;
        if (parsed.has('merges') && commit.parent.length < 2) continue;
        if (parsed.paths.length > 0 && !(await this.touches(cwd, entry, parsed.paths))) continue;
        const person = committer ? commit.committer : commit.author;
        const name = parsed.has('email') ? `${person.name} <${person.email}>` : person.name;
        let g = groups.get(name);
        if (!g) {
          g = { name, subjects: [] };
          groups.set(name, g);
        }
        g.subjects.push({ subject: subject(commit.message), time: commit.committer.timestamp, order: order++ });
      }

      const sorted = [...groups.values()].sort((a, b) => {
        if (parsed.has('numbered') && a.subjects.length !== b.subjects.length) return b.subjects.length - a.subjects.length;
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      });

      let out = '';
      for (const g of sorted) {
        if (parsed.has('summary')) {
          out += `${String(g.subjects.length).padStart(6)}\t${g.name}\n`;
        } else {
          // Oldest first, the reverse of log order.
          const subjects = [...g.subjects].sort((a, b) => a.time - b.time || b.order - a.order);
          out += `${g.name} (${g.subjects.length}):\n${subjects.map((s) => `      ${s.subject}\n`).join('')}\n`;
        }
      }
      return createSuccessResult(out);
    } catch (error) {
      if (error instanceof RevisionError) return createErrorResult(error.message, 128);
      return createErrorResult(`git shortlog: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /** Commits reachable from `starts`, stopping at `stop`, newest first. */
  private async reachable(dir: string, starts: string[], stop: Set<string> | Map<string, ReadCommitResult>, firstParent: boolean): Promise<Map<string, ReadCommitResult>> {
    const seen = new Map<string, ReadCommitResult>();
    const queue = starts.filter((oid) => !stop.has(oid));
    while (queue.length > 0) {
      const oid = queue.shift()!;
      if (seen.has(oid) || stop.has(oid)) continue;
      const entry = await this.git.readCommit({ dir, oid });
      seen.set(oid, entry);
      for (const parent of firstParent ? entry.commit.parent.slice(0, 1) : entry.commit.parent) {
        if (!seen.has(parent) && !stop.has(parent)) queue.push(parent);
      }
    }
    return new Map([...seen].sort(([, a], [, b]) => b.commit.committer.timestamp - a.commit.committer.timestamp));
  }

  /** Whether a commit changes any path matching `pathspecs` relative to every parent. */
  private async touches(dir: string, entry: ReadCommitResult, pathspecs: string[]): Promise<boolean> {
    const files = (tree: string) => this.matching(dir, tree, pathspecs);
    const mine = await files(entry.commit.tree);
    if (entry.commit.parent.length === 0) return mine.size > 0;
    for (const parent of entry.commit.parent) {
      const theirs = await files((await this.git.readCommit({ dir, oid: parent })).commit.tree);
      if (theirs.size === mine.size && [...mine].every(([path, oid]) => theirs.get(path) === oid)) return false;
    }
    return true;
  }

  private async matching(dir: string, tree: string, pathspecs: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (pathspecs.every((spec) => !/[*?[]/.test(spec))) {
      for (const spec of pathspecs) {
        if (spec === '.' || spec === './' || spec === '') {
          result.set('', tree);
          continue;
        }
        const entry = await lookupPath(this.git, dir, tree, spec);
        if (entry) result.set(entry.path, entry.oid);
      }
      return result;
    }
    for (const [path, entry] of await listTree(this.git, dir, tree)) {
      if (matchesPathspec(path, pathspecs)) result.set(path, entry.oid);
    }
    return result;
  }
}

function subject(message: string): string {
  return message.trim().split(/\n\s*\n/)[0]?.replace(/\s*\n\s*/g, ' ') ?? '';
}
