import type { ReadCommitResult } from "isomorphic-git";
import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption, type ParsedArgs } from "./args";
import { compareSnapshots, formatChanges, treeSnapshot, type DiffFormat } from "./diffing";
import { parseRange, walkCommits } from "./history";
import { formatCommit, loadDecorations, normalizePrettyFormat, type Decorations } from "./pretty";
import { isRevision, RevisionError } from "./revisions";

/** Options shared by `git log` and `git show` for printing commits. */
export const COMMIT_DISPLAY_SPEC = {
  flags: {
    oneline: 'oneline', 'abbrev-commit': 'abbrevCommit', decorate: 'decorate',
    p: 'patch', u: 'patch', patch: 'patch', s: 'noPatch', 'no-patch': 'noPatch',
    stat: 'stat', shortstat: 'shortstat', numstat: 'numstat', 'name-only': 'nameOnly', 'name-status': 'nameStatus',
    'no-color': 'noColor', color: 'color', 'no-renames': 'noRenames', M: 'renames', 'find-renames': 'renames',
    'full-index': 'fullIndex', binary: 'binary', 'no-ext-diff': 'noExtDiff',
  },
  values: { format: 'format', pretty: 'format', date: 'date', U: 'unified', unified: 'unified' },
  optional: { decorate: 'decorate', color: 'color', stat: 'stat' },
} as const;

export interface CommitDisplay {
  format: string;
  abbrevCommit: boolean;
  dateStyle?: string;
  decorations?: Decorations;
  diff: DiffFormat | null;
}

/** Read the display options from parsed `log`/`show` arguments. */
export async function commitDisplay(git: Git, dir: string, parsed: ParsedArgs, defaultPatch: boolean): Promise<CommitDisplay> {
  let format = parsed.has('oneline') ? 'oneline' : 'medium';
  const pretty = parsed.get('format');
  if (pretty !== undefined) format = normalizePrettyFormat(pretty);
  else if (parsed.flags.get('format') === true) format = 'medium';

  const abbrevCommit = parsed.negated('abbrevCommit') ? false : parsed.has('oneline') || parsed.has('abbrevCommit');

  const diff: DiffFormat = {
    patch: parsed.has('patch'),
    stat: parsed.has('stat'),
    shortstat: parsed.has('shortstat'),
    numstat: parsed.has('numstat'),
    nameOnly: parsed.has('nameOnly'),
    nameStatus: parsed.has('nameStatus'),
    context: parsed.get('unified') !== undefined ? parseInt(parsed.get('unified')!, 10) || 0 : 3,
  };
  const anyDiff = diff.patch || diff.stat || diff.shortstat || diff.numstat || diff.nameOnly || diff.nameStatus;
  if (!anyDiff && defaultPatch) diff.patch = true;

  const decorate = parsed.get('decorate') ?? (parsed.has('decorate') ? 'short' : undefined);
  const decorations = decorate && decorate !== 'no' && !parsed.negated('decorate') ? await loadDecorations(git, dir) : undefined;

  return {
    format,
    abbrevCommit,
    dateStyle: parsed.get('date'),
    decorations,
    diff: parsed.has('noPatch') || !(anyDiff || defaultPatch) ? null : diff,
  };
}

/** The changes a commit introduced relative to its first parent (none for merges). */
export async function commitDiff(git: Git, dir: string, entry: ReadCommitResult, format: DiffFormat, pathspecs: string[] = []): Promise<string> {
  const { commit } = entry;
  if (commit.parent.length > 1) return '';
  const parentTree = commit.parent[0] ? (await git.readCommit({ dir, oid: commit.parent[0] })).commit.tree : null;
  const changes = compareSnapshots(await treeSnapshot(git, dir, parentTree), await treeSnapshot(git, dir, commit.tree), pathspecs);
  return formatChanges(git, dir, changes, format);
}

/** One commit with its diff, laid out the way `git log` does. */
export async function renderCommit(git: Git, dir: string, entry: ReadCommitResult, display: CommitDisplay, pathspecs: string[] = []): Promise<string> {
  const header = formatCommit(entry, display);
  const diff = display.diff ? await commitDiff(git, dir, entry, display.diff, pathspecs) : '';
  const userFormat = display.format.startsWith('format:') || display.format.startsWith('tformat:');
  let out = header === '' && userFormat ? '' : `${header}\n`;
  if (diff) out += display.format === 'oneline' ? diff : `\n${diff}`;
  return out;
}

export class GitLogCommand implements GitSubcommand {
  name = 'log';
  description = 'Show commit logs';
  usage = 'git log [<options>] [<revision-range>] [[--] <path>...]';

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
        return createErrorResult('fatal: not a git repository (or any of the parent directories): .git');
      }

      const parsed = parseArgs(args, {
        flags: {
          ...COMMIT_DISPLAY_SPEC.flags,
          graph: 'graph', all: 'all', 'no-merges': 'noMerges', merges: 'merges', reverse: 'reverse',
          'first-parent': 'firstParent', i: 'ignoreCase', 'regexp-ignore-case': 'ignoreCase', 'all-match': 'allMatch',
          'invert-grep': 'invertGrep', E: 'extendedRegexp', 'extended-regexp': 'extendedRegexp', F: 'fixedStrings', 'fixed-strings': 'fixedStrings',
          follow: 'follow', 'topo-order': 'topoOrder', 'date-order': 'dateOrder', 'full-history': 'fullHistory',
          'no-walk': 'noWalk', 'show-signature': 'showSignature', 'source': 'source', 'log-size': 'logSize',
          'no-abbrev': 'noAbbrev', 'ignore-missing': 'ignoreMissing', 'no-decorate': 'noDecorate',
        },
        values: {
          ...COMMIT_DISPLAY_SPEC.values,
          n: 'maxCount', 'max-count': 'maxCount', skip: 'skip', author: 'author', committer: 'committer', grep: 'grep',
          since: 'since', after: 'since', until: 'until', before: 'until', 'since-as-filter': 'since',
        },
        optional: COMMIT_DISPLAY_SPEC.optional,
        numeric: 'maxCount',
      });
      if (parsed.unknown.length > 0) {
        return createErrorResult(unknownOption(parsed.unknown[0], this.usage));
      }
      if (parsed.has('noDecorate')) parsed.flags.set('decorate', false);

      // Split positionals into revisions and paths, like git does.
      const revs: string[] = [];
      const paths = [...parsed.paths];
      for (const arg of parsed.positionals) {
        if (paths.length === 0 && (arg.includes('..') || arg.startsWith('^') || await isRevision(this.git, cwd, arg))) {
          revs.push(arg);
        } else if (await this.exists(cwd, arg)) {
          paths.push(arg);
        } else {
          return createErrorResult(`fatal: ambiguous argument '${arg}': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'`);
        }
      }

      let range;
      try {
        range = await parseRange(this.git, cwd, revs, parsed.has('all'));
      } catch (error) {
        if (error instanceof RevisionError) {
          if (revs.length === 0) {
            const branch = (await this.git.currentBranch({ dir: cwd })) ?? 'HEAD';
            return createErrorResult(`fatal: your current branch '${branch}' does not have any commits yet`);
          }
          return createErrorResult(error.message);
        }
        throw error;
      }

      const display = await commitDisplay(this.git, cwd, parsed, false);
      const filter = this.buildFilter(parsed);
      const maxCount = parsed.get('maxCount') !== undefined ? parseInt(parsed.get('maxCount')!, 10) : Infinity;
      let skip = parsed.get('skip') !== undefined ? parseInt(parsed.get('skip')!, 10) : 0;

      const entries: ReadCommitResult[] = [];
      if (maxCount > 0) {
        for await (const entry of walkCommits(this.git, cwd, range, { firstParent: parsed.has('firstParent'), paths })) {
          if (!filter(entry)) continue;
          if (skip > 0) {
            skip--;
            continue;
          }
          entries.push(entry);
          if (!parsed.has('reverse') && entries.length >= maxCount) break;
        }
      }
      if (parsed.has('reverse')) entries.splice(maxCount);
      if (parsed.has('reverse')) entries.reverse();

      const multiline = !['oneline'].includes(display.format) && !display.format.includes(':');
      const separator = display.format.startsWith('format:') ? '\n' : '';
      let out = '';
      for (let i = 0; i < entries.length; i++) {
        let text = await renderCommit(this.git, cwd, entries[i], display, paths);
        if (display.format.startsWith('format:')) text = text.replace(/\n$/, '');
        if (parsed.has('graph')) text = graph(text, i === entries.length - 1);
        if (i > 0) out += multiline ? (parsed.has('graph') ? '|\n' : '\n') : separator;
        out += text;
      }
      if (display.format.startsWith('format:') && out) out += '\n';
      return createSuccessResult(out);
    } catch (error) {
      return createErrorResult(`git log: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async exists(cwd: string, path: string): Promise<boolean> {
    try {
      await this.fs.stat(`${cwd}/${path}`);
      return true;
    } catch {
      return false;
    }
  }

  private buildFilter(parsed: ParsedArgs): (entry: ReadCommitResult) => boolean {
    const flags = parsed.has('ignoreCase') ? 'i' : '';
    const toRegExp = (pattern: string) => {
      if (parsed.has('fixedStrings')) return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      try {
        return new RegExp(pattern, flags);
      } catch {
        return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      }
    };
    const authors = parsed.getAll('author').map(toRegExp);
    const committers = parsed.getAll('committer').map(toRegExp);
    const greps = parsed.getAll('grep').map(toRegExp);
    const since = parsed.get('since') !== undefined ? parseDate(parsed.get('since')!) : undefined;
    const until = parsed.get('until') !== undefined ? parseDate(parsed.get('until')!) : undefined;

    return ({ commit }) => {
      const author = `${commit.author.name} <${commit.author.email}>`;
      const committer = `${commit.committer.name} <${commit.committer.email}>`;
      if (authors.length && !authors.some((re) => re.test(author))) return false;
      if (committers.length && !committers.some((re) => re.test(committer))) return false;
      if (greps.length) {
        const hits = greps.map((re) => re.test(commit.message));
        let match = parsed.has('allMatch') ? hits.every(Boolean) : hits.some(Boolean);
        if (parsed.has('invertGrep')) match = !match;
        if (!match) return false;
      }
      if (since !== undefined && commit.committer.timestamp < since) return false;
      if (until !== undefined && commit.committer.timestamp > until) return false;
      if (parsed.has('noMerges') && commit.parent.length > 1) return false;
      if (parsed.has('merges') && commit.parent.length < 2) return false;
      return true;
    };
  }
}

/** Prefix lines with a (linear) commit graph. */
function graph(text: string, last: boolean): string {
  const lines = text.replace(/\n$/, '').split('\n');
  return lines.map((line, i) => (i === 0 ? `* ${line}` : `${last ? ' ' : '|'} ${line}`).trimEnd() + '\n').join('');
}

/** Parse `--since`/`--until` dates: absolute dates and "2 weeks ago" style. Returns Unix seconds. */
export function parseDate(value: string): number | undefined {
  const now = Math.floor(Date.now() / 1000);
  const lower = value.toLowerCase().trim().replace(/\./g, ' ');
  if (/^\d+$/.test(lower) && lower.length >= 9) return parseInt(lower, 10);
  if (lower === 'now') return now;
  if (lower === 'yesterday') return now - 86400;
  if (lower === 'today' || lower === 'midnight') return now - (now % 86400);

  const units: Record<string, number> = {
    second: 1, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2592000, year: 31536000,
  };
  const relative = lower.match(/^(\d+|an?|one)\s*(second|sec|minute|min|hour|day|week|month|year)s?(\s+ago)?$/);
  if (relative) {
    const n = /^\d+$/.test(relative[1]) ? parseInt(relative[1], 10) : 1;
    const unit = { sec: 'second', min: 'minute' }[relative[2]] ?? relative[2];
    return now - n * units[unit];
  }

  const parsed = Date.parse(value);
  return isNaN(parsed) ? undefined : Math.floor(parsed / 1000);
}
