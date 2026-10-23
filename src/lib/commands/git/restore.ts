import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { treeSnapshot, type Snapshot } from "./diffing";
import { resolveTree } from "./revisions";
import { NOT_A_REPO, fatal, headOid, isRepo, normalizePathspecs, output, pathspecDidNotMatch, restorePaths } from "./worktree";

export class GitRestoreCommand implements GitSubcommand {
  name = 'restore';
  description = 'Restore working tree files';
  usage = 'git restore [<options>] [--source=<branch>] <file>...';

  private git: Git;
  private fs: JSRuntimeFS;

  constructor(options: GitSubcommandOptions) {
    this.git = options.git;
    this.fs = options.fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    try {
      if (!(await isRepo(this.fs, cwd))) return fatal(NOT_A_REPO);

      const parsed = parseArgs(args, {
        flags: {
          S: 'staged', staged: 'staged', W: 'worktree', worktree: 'worktree', q: 'quiet', quiet: 'quiet',
          p: 'patch', patch: 'patch', overlay: 'overlay', ours: 'ours', theirs: 'theirs', m: 'merge', merge: 'merge',
          'ignore-unmerged': 'ignoreUnmerged', progress: 'progress', 'ignore-skip-worktree-bits': 'ignoreSkipWorktreeBits',
        },
        values: { s: 'source', source: 'source', conflict: 'conflict' },
      });
      if (parsed.unknown.length > 0) {
        return createErrorResult(unknownOption(parsed.unknown[0], this.usage), 129);
      }
      if (parsed.has('patch')) {
        return fatal('interactive patch mode (-p) is not supported here; restore whole files instead');
      }

      const paths = parsed.rest;
      if (paths.length === 0) return fatal('you must specify path(s) to restore');
      const normalized = normalizePathspecs(cwd, paths);
      if ('error' in normalized) return normalized.error;

      const staged = parsed.has('staged');
      const worktree = parsed.has('worktree') || !staged;

      const sourceSpec = parsed.get('source') ?? (staged ? 'HEAD' : undefined);
      let source: Snapshot | undefined;
      if (sourceSpec !== undefined) {
        try {
          source = await treeSnapshot(this.git, cwd, await resolveTree(this.git, cwd, sourceSpec));
        } catch {
          if (sourceSpec === 'HEAD' && !(await headOid(this.git, cwd))) {
            source = new Map();
          } else {
            return fatal(`could not resolve '${sourceSpec}'`);
          }
        }
      }

      const { unmatched } = await restorePaths(this.git, this.fs, cwd, normalized.specs, {
        source,
        staged,
        worktree,
        overlay: parsed.has('overlay'),
      });
      if (unmatched.length > 0) {
        return createErrorResult(unmatched.map((i) => pathspecDidNotMatch(paths[i])).join('\n'));
      }
      return output('');
    } catch (error) {
      return createErrorResult(`git restore: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
