import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { parseRange, walkCommits } from "./history";
import { normalizePrettyFormat, expandFormat, formatCommit } from "./pretty";
import { abbrev, RevisionError } from "./revisions";

export class GitRevListCommand implements GitSubcommand {
  name = 'rev-list';
  description = 'Lists commit objects in reverse chronological order';
  usage = 'git rev-list [--count] [--max-count=<n>] [--reverse] [--first-parent] [--all] [--abbrev-commit] <commit>... [-- <path>...]';

  private git: Git;
  private fs: JSRuntimeFS;

  constructor(options: GitSubcommandOptions) {
    this.git = options.git;
    this.fs = options.fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    try {
      await this.fs.stat(`${cwd}/.git`);
    } catch {
      return createErrorResult('fatal: not a git repository (or any of the parent directories): .git');
    }

    const parsed = parseArgs(args, {
      flags: {
        count: 'count', reverse: 'reverse', 'first-parent': 'firstParent', all: 'all', 'abbrev-commit': 'abbrevCommit',
        'no-merges': 'noMerges', merges: 'merges', parents: 'parents', 'topo-order': 'topo', 'date-order': 'date',
        oneline: 'oneline', 'left-right': 'leftRight',
      },
      values: { n: 'maxCount', 'max-count': 'maxCount', skip: 'skip', format: 'format', pretty: 'format' },
      numeric: 'maxCount',
    });
    if (parsed.unknown.length > 0) return createErrorResult(unknownOption(parsed.unknown[0], this.usage));
    if (parsed.positionals.length === 0 && !parsed.has('all')) {
      return createErrorResult(`usage: ${this.usage}`);
    }

    try {
      const range = await parseRange(this.git, cwd, parsed.positionals, parsed.has('all'));
      const max = parsed.get('maxCount') !== undefined ? parseInt(parsed.get('maxCount')!, 10) : Infinity;
      let skip = parsed.get('skip') !== undefined ? parseInt(parsed.get('skip')!, 10) : 0;

      const entries = [];
      for await (const entry of walkCommits(this.git, cwd, range, { firstParent: parsed.has('firstParent'), paths: parsed.paths })) {
        const merges = entry.commit.parent.length > 1;
        if ((parsed.has('noMerges') && merges) || (parsed.has('merges') && !merges)) continue;
        if (skip > 0) {
          skip--;
          continue;
        }
        entries.push(entry);
        if (!parsed.has('reverse') && entries.length >= max) break;
      }
      if (parsed.has('reverse')) entries.splice(max);
      if (parsed.has('reverse')) entries.reverse();

      if (parsed.has('count')) return createSuccessResult(`${entries.length}\n`);

      const length = parsed.has('abbrevCommit') || parsed.has('oneline') ? 7 : 40;
      const format = parsed.get('format');
      let out = '';
      for (const entry of entries) {
        const parents = parsed.has('parents') ? entry.commit.parent.map((p) => ` ${abbrev(p, length)}`).join('') : '';
        if (parsed.has('oneline')) {
          out += `${formatCommit(entry, { format: 'oneline', abbrevCommit: true })}\n`;
        } else if (format !== undefined) {
          out += `commit ${abbrev(entry.oid, length)}${parents}\n${expandFormat(entry, normalizePrettyFormat(format).replace(/^t?format:/, ''))}\n`;
        } else {
          out += `${abbrev(entry.oid, length)}${parents}\n`;
        }
      }
      return createSuccessResult(out);
    } catch (error) {
      if (error instanceof RevisionError) return createErrorResult(error.message);
      return createErrorResult(`fatal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
