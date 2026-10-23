import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import {
  compareSnapshots, formatChanges, indexSnapshot, treeSnapshot, workdirSnapshot, ZERO_OID,
  type DiffFormat, type FileChange, type Snapshot,
} from "./diffing";
import { isRevision, resolveCommit, resolveTree, RevisionError } from "./revisions";
import { resolvePath } from "../utils";

export class GitDiffCommand implements GitSubcommand {
  name = 'diff';
  description = 'Show changes between commits, commit and working tree, etc';
  usage = 'git diff [<options>] [--cached] [<commit> [<commit>]] [--] [<path>...]';

  private git: Git;
  private fs: JSRuntimeFS;

  constructor(options: GitSubcommandOptions) {
    this.git = options.git;
    this.fs = options.fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    try {
      const parsed = parseArgs(args, {
        flags: {
          cached: 'cached', staged: 'cached', 'no-index': 'noIndex',
          p: 'patch', u: 'patch', patch: 'patch', s: 'noPatch', 'no-patch': 'noPatch',
          stat: 'stat', shortstat: 'shortstat', numstat: 'numstat', 'name-only': 'nameOnly', 'name-status': 'nameStatus',
          'exit-code': 'exitCode', quiet: 'quiet',
          // Accepted for compatibility; output is never colored and whitespace is always significant.
          color: 'color', 'no-color': 'noColor', w: 'ignoreSpace', 'ignore-all-space': 'ignoreSpace',
          b: 'ignoreSpace', 'ignore-space-change': 'ignoreSpace', 'ignore-blank-lines': 'ignoreSpace',
          M: 'renames', 'find-renames': 'renames', 'no-renames': 'noRenames', 'full-index': 'fullIndex',
          binary: 'binary', 'no-ext-diff': 'noExtDiff', 'minimal': 'minimal', patience: 'patience', histogram: 'histogram',
        },
        values: { U: 'unified', unified: 'unified', 'diff-filter': 'diffFilter', 'diff-algorithm': 'algorithm' },
        optional: { color: 'color', stat: 'stat' },
      });
      if (parsed.unknown.length > 0) {
        return createErrorResult(unknownOption(parsed.unknown[0], this.usage));
      }

      const format: DiffFormat = {
        patch: parsed.has('patch'),
        stat: parsed.has('stat'),
        shortstat: parsed.has('shortstat'),
        numstat: parsed.has('numstat'),
        nameOnly: parsed.has('nameOnly'),
        nameStatus: parsed.has('nameStatus'),
        context: parsed.get('unified') !== undefined ? parseInt(parsed.get('unified')!, 10) || 0 : 3,
      };
      if (!format.stat && !format.shortstat && !format.numstat && !format.nameOnly && !format.nameStatus) {
        format.patch = !parsed.has('noPatch');
      }

      let changes: FileChange[];
      if (parsed.has('noIndex')) {
        const files = parsed.rest;
        if (files.length !== 2) return createErrorResult('usage: git diff --no-index [<options>] <path> <path>');
        changes = await this.compareFiles(cwd, files[0], files[1]);
      } else {
        try {
          await this.fs.stat(`${cwd}/.git`);
        } catch {
          return createErrorResult('fatal: not a git repository (or any of the parent directories): .git');
        }
        const result = await this.collectChanges(cwd, parsed.positionals, parsed.paths, parsed.has('cached'));
        if (typeof result === 'string') return createErrorResult(result);
        changes = result;
      }

      const filter = parsed.get('diffFilter');
      if (filter) {
        const include = filter.replace(/[a-z]/g, '');
        const exclude = filter.replace(/[A-Z]/g, '').toUpperCase();
        changes = changes.filter((c) => (!include || include.includes(c.status)) && !exclude.includes(c.status));
      }

      const exitCode = (parsed.has('exitCode') || parsed.has('quiet') || parsed.has('noIndex')) && changes.length > 0 ? 1 : 0;
      const stdout = parsed.has('quiet') ? '' : await formatChanges(this.git, cwd, changes, format);
      return { exitCode, stdout, stderr: '' };
    } catch (error) {
      if (error instanceof RevisionError) return createErrorResult(error.message);
      return createErrorResult(`git diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async collectChanges(cwd: string, positionals: string[], dashPaths: string[], cached: boolean): Promise<FileChange[] | string> {
    // Leading positionals that are revisions; the rest are paths.
    const revs: string[] = [];
    const paths = [...dashPaths];
    for (const arg of positionals) {
      if (paths.length === dashPaths.length && revs.length < 2 && (/\.\./.test(arg) || await isRevision(this.git, cwd, arg))) {
        revs.push(arg);
      } else if (await this.exists(resolvePath(arg, cwd)) || dashPaths.length > 0) {
        paths.unshift(arg);
      } else {
        return `fatal: ambiguous argument '${arg}': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'`;
      }
    }

    const index = await indexSnapshot(this.git, cwd);

    if (revs.length === 1 && revs[0].includes('..')) {
      const symmetric = revs[0].includes('...');
      const [a, b] = revs[0].split(symmetric ? '...' : '..');
      const from = a || 'HEAD';
      const to = b || 'HEAD';
      let base = from;
      if (symmetric) {
        const oids = await Promise.all([from, to].map((r) => this.commitOid(cwd, r)));
        const [mergeBase] = await this.git.findMergeBase({ dir: cwd, oids });
        if (!mergeBase) return `fatal: ${from}...${to}: no merge base`;
        base = mergeBase;
      }
      return compareSnapshots(await this.tree(cwd, base), await this.tree(cwd, to), paths);
    }

    if (revs.length === 2) {
      return compareSnapshots(await this.tree(cwd, revs[0]), await this.tree(cwd, revs[1]), paths);
    }

    if (cached) {
      let base: Snapshot;
      try {
        base = await this.tree(cwd, revs[0] ?? 'HEAD');
      } catch (error) {
        // No commits yet: everything staged is new.
        if (revs.length > 0) throw error;
        base = new Map();
      }
      return compareSnapshots(base, index, paths);
    }

    if (revs.length === 1) {
      const tree = await this.tree(cwd, revs[0]);
      const tracked: Snapshot = new Map([...tree, ...index]);
      return compareSnapshots(tree, await workdirSnapshot(this.git, this.fs, cwd, tracked), paths);
    }

    return compareSnapshots(index, await workdirSnapshot(this.git, this.fs, cwd, index), paths);
  }

  private async commitOid(cwd: string, rev: string): Promise<string> {
    return resolveCommit(this.git, cwd, rev);
  }

  private async tree(cwd: string, rev: string): Promise<Snapshot> {
    return treeSnapshot(this.git, cwd, await resolveTree(this.git, cwd, rev));
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await this.fs.stat(path);
      return true;
    } catch {
      return false;
    }
  }

  /** `--no-index`: compare two files outside the repository. */
  private async compareFiles(cwd: string, a: string, b: string): Promise<FileChange[]> {
    const read = async (path: string) => {
      try {
        return await this.fs.readFile(resolvePath(path, cwd));
      } catch {
        return undefined;
      }
    };
    const [oldBytes, newBytes] = await Promise.all([read(a), read(b)]);
    if (!oldBytes && !newBytes) throw new Error(`Could not access '${a}'`);
    const version = async (bytes: Uint8Array | undefined) => bytes
      ? { oid: (await this.git.hashBlob({ object: bytes })).oid, mode: '100644', content: bytes }
      : undefined;
    const oldVersion = await version(oldBytes);
    const newVersion = await version(newBytes);
    if (oldVersion?.oid === newVersion?.oid) return [];
    const path = b.replace(/^\.\//, '');
    return [{
      path,
      status: !oldVersion ? 'A' : !newVersion ? 'D' : 'M',
      old: oldVersion ?? { oid: ZERO_OID, mode: '100644', content: new Uint8Array() },
      new: newVersion ?? { oid: ZERO_OID, mode: '100644', content: new Uint8Array() },
    }];
  }
}
