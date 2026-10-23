import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { resolveCommit, RevisionError } from "./revisions";

export class GitMergeBaseCommand implements GitSubcommand {
  name = 'merge-base';
  description = 'Find as good common ancestors as possible for a merge';
  usage = 'git merge-base [-a] <commit> <commit>... | --is-ancestor <commit> <commit>';

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

    const parsed = parseArgs(args, { flags: { a: 'all', all: 'all', 'is-ancestor': 'isAncestor', octopus: 'octopus' } });
    if (parsed.unknown.length > 0) return createErrorResult(unknownOption(parsed.unknown[0], this.usage));

    const specs = parsed.positionals;
    if (specs.length < 2 || (parsed.has('isAncestor') && specs.length !== 2)) {
      return createErrorResult(`usage: ${this.usage}`);
    }

    try {
      const oids = await Promise.all(specs.map((s) => resolveCommit(this.git, cwd, s)));

      if (parsed.has('isAncestor')) {
        const [ancestor, descendant] = oids;
        const yes = ancestor === descendant || await this.git.isDescendent({ dir: cwd, oid: descendant, ancestor, depth: -1 });
        return { exitCode: yes ? 0 : 1, stdout: '', stderr: '' };
      }

      const bases = await this.git.findMergeBase({ dir: cwd, oids });
      if (bases.length === 0) return { exitCode: 1, stdout: '', stderr: '' };
      return createSuccessResult((parsed.has('all') ? bases : bases.slice(0, 1)).map((b: string) => `${b}\n`).join(''));
    } catch (error) {
      if (error instanceof RevisionError) return createErrorResult(`fatal: Not a valid object name ${specs.find(Boolean)}`);
      return createErrorResult(`fatal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
